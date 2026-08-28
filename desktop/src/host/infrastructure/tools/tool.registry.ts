import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { entityIdSchema } from "../../../shared/dto/ipc-dto";
import type { RunEvent } from "../../../shared/models/chat";
import type {
  AutomationRuntimeCatalog,
  SkillContentStore,
  ToolCallRecorder,
} from "../../application/ports/automation-runtime.ports";
import type { VectorStoreService } from "../vector-store/vector-store.service";
import { OllamaWebService } from "./ollama-web.service";
import type { ReportDocxService } from "./report-docx.service";
import type {
  AgentDirectoryPolicy,
  AgentTerminalPolicy,
  DirectoryGrant,
  PermissionMode,
} from "../../../shared/dto";
import type { CommandExecutionService } from "./command-execution.service";
import type { NativeSearchService } from "./native-search.service";
import type { MemoryService } from "../../application/services/memory.service";
import type { TaskPlanRepository } from "../database/task-plan.repository";
import type { UserQuestionService } from "../../application/services/user-question.service";
import type { FileSystemService } from "../filesystem/file-system.service";
import type { McpService } from "../mcp/mcp.service";
import type { FileEditRecord } from "../../../shared/models/chat";
import {
  extractCommandNames,
  maxPermission,
} from "../../../shared/terminal-capabilities";

type Emit = (event: RunEvent) => void;

interface ToolExecutionEvent {
  callId: string;
  toolId: string;
  input: unknown;
}

interface ToolExecutionObserver<TReference = unknown> {
  requested(event: ToolExecutionEvent): TReference;
  running?(event: ToolExecutionEvent, reference: TReference): void;
  completed?(
    event: ToolExecutionEvent,
    reference: TReference,
    output: unknown,
  ): void;
  failed?(
    event: ToolExecutionEvent,
    reference: TReference,
    error: string,
  ): void;
}

interface ToolRegistryOptions {
  signal: AbortSignal;
  allowedToolIds: string[];
  conversationId?: string;
  runId?: string;
  agentId?: string;
  memoryRead?: boolean;
  memoryWrite?: boolean;
  allowedVectorStoreIds?: string[];
  retrievalLimit?: number;
  allowedSkillIds?: string[];
  terminalPolicy?: AgentTerminalPolicy;
  directoryPolicy?: AgentDirectoryPolicy;
  projectGrants?: DirectoryGrant[];
  observer?: ToolExecutionObserver;
  onFileChanged?: (edit: FileEditRecord) => void;
}

export interface ToolOutputReader {
  toolCallOutput(runId: string, providerCallId: string): unknown;
}

export class ToolRegistry {
  constructor(
    private readonly toolCalls: ToolCallRecorder,
    private readonly automationCatalog: AutomationRuntimeCatalog,
    private readonly web: OllamaWebService,
    private readonly vectorStores: VectorStoreService,
    private readonly skillContent: SkillContentStore,
    private readonly reports: ReportDocxService,
    private readonly commands: CommandExecutionService,
    private readonly search: NativeSearchService,
    private readonly memory: MemoryService,
    private readonly taskPlans: TaskPlanRepository,
    private readonly questions: UserQuestionService,
    private readonly files: FileSystemService,
    private readonly toolOutputs: ToolOutputReader,
    private readonly mcp: McpService,
  ) {}

  create(options: ToolRegistryOptions): ToolSet | undefined {
    const {
      signal,
      allowedToolIds,
      allowedVectorStoreIds = [],
      retrievalLimit = 5,
      observer,
      allowedSkillIds = [],
      terminalPolicy,
      directoryPolicy,
      conversationId,
      runId,
      agentId,
      memoryRead = false,
      memoryWrite = false,
      projectGrants,
      onFileChanged,
    } = options;
    const fileContext = (toolCallId: string) => ({
      runId: runId ?? null,
      conversationId: conversationId ?? null,
      toolCallId,
      policy: directoryPolicy,
      projectGrants,
    });
    const reportOwnerId = conversationId ?? runId ?? "standalone";
    const reportEdit = (edit: FileEditRecord) => {
      onFileChanged?.(edit);
      return {
        path: edit.path,
        operation: edit.operation,
        movedTo: edit.movedTo,
        bytesBefore: edit.bytesBefore,
        bytesAfter: edit.bytesAfter,
        diff: edit.diff,
      };
    };
    const tools: ToolSet = {
      cmd_exec: tool({
        description:
          "Выполняет разрешённые PowerShell-команды. Для долгих задач используй background, затем status, output или wait по sessionId.",
        inputSchema: z.discriminatedUnion("action", [
          z.object({
            action: z.literal("start"),
            script: z.string().trim().min(1).max(20_000),
            purpose: z.string().trim().min(1).max(500),
            cwd: z.string().trim().optional(),
            execution: z.enum(["foreground", "background"]).optional(),
            timeoutSeconds: z.int().min(1).max(86_400).optional(),
          }),
          z.object({
            action: z.enum(["status", "output", "wait", "cancel"]),
            sessionId: z.uuid(),
            timeoutSeconds: z.int().min(1).max(30).optional(),
          }),
        ]),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "cmd_exec", input, signal, observer, () => {
            if (!terminalPolicy)
              throw new Error("Политика терминала агента не настроена");
            if (!directoryPolicy)
              throw new Error(
                "Политика доступа агента к директориям не настроена",
              );
            return this.commands.execute(
              input,
              terminalPolicy,
              directoryPolicy,
              signal,
            );
          }),
      }),
      grep_search: tool({
        description:
          "Ищет файлы и директории по имени внутри разрешённой директории. Возвращает относительные пути и типы найденных сущностей.",
        inputSchema: z.object({
          base: z.string().trim().min(1).max(4096),
          query: z.string().trim().min(1).max(500),
          entityTypes: z
            .array(z.enum(["file", "directory"]))
            .max(2)
            .optional(),
          matchMode: z.enum(["exact", "contains", "glob"]).optional(),
          includeHidden: z.boolean().optional(),
          maxDepth: z.int().min(1).max(100).optional(),
          limit: z.int().min(1).max(1000).optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "grep_search",
            input,
            signal,
            observer,
            () => {
              if (!directoryPolicy)
                throw new Error(
                  "Политика доступа агента к директориям не настроена",
                );
              return this.search.entitySearch(
                input,
                directoryPolicy,
                projectGrants,
              );
            },
          ),
      }),
      regexp_search: tool({
        description:
          "Ищет текст или регулярное выражение в конкретном файле либо рекурсивно в директории. Используй include/exclude для ограничения типов файлов.",
        inputSchema: z.object({
          base: z.string().trim().min(1).max(4096),
          target: z.string().trim().max(4096).optional(),
          pattern: z.string().trim().min(1).max(2000),
          mode: z.enum(["regex", "literal"]).optional(),
          caseSensitive: z.boolean().optional(),
          wholeWord: z.boolean().optional(),
          include: z
            .array(z.string().trim().min(1).max(500))
            .max(50)
            .optional(),
          exclude: z
            .array(z.string().trim().min(1).max(500))
            .max(50)
            .optional(),
          includeHidden: z.boolean().optional(),
          maxFileBytes: z
            .int()
            .min(1)
            .max(50 * 1024 * 1024)
            .optional(),
          limit: z.int().min(1).max(1000).optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "regexp_search",
            input,
            signal,
            observer,
            () => {
              if (!directoryPolicy)
                throw new Error(
                  "Политика доступа агента к директориям не настроена",
                );
              return this.search.regexpSearch(
                input,
                directoryPolicy,
                projectGrants,
              );
            },
          ),
      }),
      web_search: tool({
        description:
          "Ищет актуальную информацию в интернете и возвращает источники с заголовком, URL и фрагментом содержимого.",
        inputSchema: z.object({ query: z.string().trim().min(1).max(500) }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "web_search", input, signal, observer, () =>
            this.web.execute("web_search", input, signal),
          ),
      }),
      web_fetch: tool({
        description:
          "Получает веб-страницу и возвращает её заголовок, Markdown-содержимое и найденные ссылки.",
        inputSchema: z.object({ url: z.string().trim().min(1).max(4096) }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "web_fetch", input, signal, observer, () =>
            this.web.execute("web_fetch", input, signal),
          ),
      }),
      vecdb_search: tool({
        description:
          "Ищет релевантные фрагменты в разрешённых агенту векторных базах знаний.",
        inputSchema: z.object({
          query: z.string().trim().min(1).max(2000),
          storeIds: z.array(entityIdSchema).optional(),
          limit: z.int().min(1).max(20).optional(),
          scoreThreshold: z.number().min(0).max(1).optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "vecdb_search",
            input,
            signal,
            observer,
            () => {
              const requested = input.storeIds?.length
                ? input.storeIds
                : allowedVectorStoreIds;
              const effective = requested.filter((id) =>
                allowedVectorStoreIds.includes(id),
              );
              if (!effective.length)
                throw new Error(
                  "Агенту не разрешён доступ к векторным хранилищам",
                );
              return this.vectorStores.search({
                vectorStoreIds: effective,
                query: input.query,
                limit: input.limit ?? retrievalLimit,
                scoreThreshold: input.scoreThreshold,
              });
            },
          ),
      }),
      "skills.load": tool({
        description:
          "Загружает полные инструкции назначенного агенту навыка. Используй перед применением навыка.",
        inputSchema: z.object({ skillId: entityIdSchema }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "skills.load",
            input,
            signal,
            observer,
            // eslint-disable-next-line @typescript-eslint/require-await
            async () => {
              if (!allowedSkillIds.includes(input.skillId))
                throw new Error("Навык не назначен агенту");
              const skill = this.automationCatalog
                .listSkills()
                .find(
                  (item) =>
                    item.id === input.skillId && item.status === "active",
                );
              if (!skill) throw new Error("Навык недоступен");
              return {
                id: skill.id,
                name: skill.name,
                instructions: this.skillContent.read(skill.slug),
              };
            },
          ),
      }),
      tasks_plan: tool({
        description:
          "Составляет или обновляет список задач текущей работы. Передавай полный актуальный список: он заменяет предыдущий. Список видит пользователь.",
        inputSchema: z.object({
          tasks: z
            .array(
              z.object({
                subject: z.string().trim().min(1).max(200),
                detail: z.string().trim().max(1_000).default(""),
                status: z
                  .enum(["pending", "in_progress", "completed", "skipped"])
                  .default("pending"),
              }),
            )
            .min(1)
            .max(50),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "tasks_plan",
            input,
            signal,
            observer,
            async () => {
              if (!conversationId)
                throw new Error("План задач доступен только в диалоге");
              const plan = this.taskPlans.replace(
                { conversationId },
                input.tasks,
              );
              return {
                taskCount: plan.items.length,
                updatedAt: plan.updatedAt,
              };
            },
          ),
      }),
      memory_search: tool({
        description:
          "Ищет в долговременной памяти факты, предпочтения и указания пользователя, сохранённые ранее.",
        inputSchema: z.object({
          query: z.string().trim().min(1).max(500),
          limit: z.int().min(1).max(25).optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "memory_search",
            input,
            signal,
            observer,
            async () => ({
              entries: this.memory
                .search(input.query, input.limit ?? 10, memoryRead)
                .map((entry) => ({
                  id: entry.id,
                  kind: entry.kind,
                  title: entry.title,
                  content: entry.content,
                  tags: entry.tags,
                })),
            }),
          ),
      }),
      memory_save: tool({
        description:
          "Сохраняет в долговременную память то, что должно пережить текущий диалог: факт о пользователе, его предпочтение или указание. Заголовок служит ключом — повторное сохранение обновляет запись.",
        inputSchema: z.object({
          kind: z.enum(["fact", "preference", "instruction", "episode"]),
          title: z.string().trim().min(1).max(200),
          content: z.string().trim().min(1).max(20_000),
          tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "memory_save",
            input,
            signal,
            observer,
            async () => {
              const entry = this.memory.save(
                { ...input, tags: input.tags ?? [] },
                {
                  source: conversationId ? "chat" : "scenario",
                  conversationId: conversationId ?? null,
                  agentId: agentId ?? null,
                  agentMayWrite: memoryWrite,
                },
              );
              return { id: entry.id, title: entry.title, kind: entry.kind };
            },
          ),
      }),
      ask_user: tool({
        description:
          "Задаёт пользователю уточняющий вопрос и дожидается ответа. Используй, когда без решения пользователя работа пойдёт не туда. Не спрашивай о том, что выводится из контекста.",
        inputSchema: z.object({
          header: z.string().trim().max(60).optional(),
          question: z.string().trim().min(1).max(1_000),
          options: z
            .array(
              z.object({
                label: z.string().trim().min(1).max(120),
                description: z.string().trim().max(400).optional(),
              }),
            )
            .max(4)
            .optional(),
          multiSelect: z.boolean().optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "ask_user",
            input,
            signal,
            observer,
            async () => {
              if (!conversationId || !runId)
                throw new Error(
                  "Вопрос доступен только в диалоге. В сценарии используй узел «Вопрос».",
                );
              const answer = await this.questions.askInChat(
                {
                  mode: input.options?.length ? "choice" : "text",
                  header: input.header ?? "Уточнение",
                  question: input.question,
                  options: input.options ?? [],
                  multiSelect: Boolean(input.multiSelect),
                },
                { conversationId, runId },
                signal,
              );
              return { answer };
            },
          ),
      }),
      reports_docx: tool({
        description:
          "Создаёт небольшой DOCX до 12 блоков. Для полноценного отчёта обязательно используй reports_begin, несколько reports_add_blocks и reports_commit.",
        inputSchema: z.object({
          fileName: z.string().trim().min(1).max(180),
          template: z.literal("mirea-report-gost"),
          title: z.string().trim().max(500).optional(),
          blocks: z
            .array(
              z.discriminatedUnion("type", [
                z.object({
                  type: z.literal("heading"),
                  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
                  text: z.string().trim().min(1).max(500),
                  numbered: z.boolean().optional(),
                }),
                z.object({
                  type: z.literal("paragraph"),
                  paragraphs: z
                    .array(z.string().trim().min(1).max(20_000))
                    .min(1)
                    .max(200),
                }),
                z.object({
                  type: z.literal("list"),
                  style: z.enum(["bullet", "numbered"]),
                  items: z
                    .array(z.string().trim().min(1).max(5_000))
                    .min(1)
                    .max(200),
                }),
                z.object({
                  type: z.literal("table"),
                  number: z.string().trim().max(30).optional(),
                  title: z.string().trim().min(1).max(500),
                  headers: z.array(z.string().max(1_000)).min(1).max(30),
                  rows: z
                    .array(z.array(z.string().max(10_000)).max(30))
                    .max(1_000),
                }),
                z.object({
                  type: z.literal("code"),
                  number: z.string().trim().max(30).optional(),
                  title: z.string().trim().min(1).max(500),
                  language: z.string().trim().max(50).optional(),
                  content: z.string().max(100_000),
                }),
                z.object({ type: z.literal("pageBreak") }),
              ]),
            )
            .min(1)
            .max(12),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "reports_docx",
            input,
            signal,
            observer,
            () => this.reports.create(input),
          ),
      }),
      reports_begin: tool({
        description:
          "Начинает поэтапную сборку большого DOCX-отчёта и возвращает sessionId с nextSequence=0.",
        inputSchema: z.object({
          fileName: z.string().trim().min(1).max(180),
          template: z.literal("mirea-report-gost"),
          title: z.string().trim().max(500).optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "reports_begin",
            input,
            signal,
            observer,
            () => {
              return Promise.resolve(this.reports.begin(input, reportOwnerId));
            },
          ),
      }),
      reports_add_blocks: tool({
        description:
          'Добавляет до 2 компактных последовательных блоков в DOCX. Передавай точный nextSequence. Форматы: paragraph={"type":"paragraph","paragraphs":["текст"]}; heading={"type":"heading","level":1,"text":"заголовок"}; list={"type":"list","style":"bullet","items":["пункт"]}; code={"type":"code","title":"название","content":"код"}. У paragraph нет поля text. Длинный текст разбивай между вызовами.',
        inputSchema: z.object({
          sessionId: z.uuid(),
          sequence: z.int().nonnegative(),
          blocks: z.array(reportBlockSchema()).min(1).max(2),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "reports_add_blocks",
            input,
            signal,
            observer,
            () => Promise.resolve(this.reports.addBlocks(input, reportOwnerId)),
          ),
      }),
      reports_commit: tool({
        description:
          "Собирает и сохраняет DOCX после успешной передачи всех блоков.",
        inputSchema: z.object({ sessionId: z.uuid() }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "reports_commit",
            input,
            signal,
            observer,
            () => this.reports.commit(input, reportOwnerId),
          ),
      }),
      reports_abort: tool({
        description: "Отменяет незавершённую сборку DOCX.",
        inputSchema: z.object({ sessionId: z.uuid() }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "reports_abort",
            input,
            signal,
            observer,
            () => Promise.resolve(this.reports.abort(input, reportOwnerId)),
          ),
      }),
      fs_read: tool({
        description:
          "Читает текстовый файл с нумерацией строк. Обязателен перед любой правкой: редактировать непрочитанный файл запрещено. Большие файлы читай фрагментами через offset и limit.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
          offset: z.int().nonnegative().optional(),
          limit: z.int().min(1).max(5_000).optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "fs_read", input, signal, observer, () =>
            Promise.resolve(this.files.read(input, fileContext(toolCallId))),
          ),
      }),
      fs_list: tool({
        description:
          "Показывает структуру директории. Служебные каталоги (node_modules, .git, dist, target) пропускаются.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
          depth: z.int().min(1).max(8).optional(),
          limit: z.int().min(1).max(2_000).optional(),
          includeHidden: z.boolean().optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "fs_list", input, signal, observer, () =>
            Promise.resolve(this.files.list(input, fileContext(toolCallId))),
          ),
      }),
      fs_write: tool({
        description:
          "Создаёт или полностью перезаписывает небольшой файл. Если содержимое длиннее 6000 символов, обязательно используй fs_write_begin, fs_write_chunk и fs_write_commit.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
          content: z.string().max(6_000),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "fs_write", input, signal, observer, () =>
            Promise.resolve(
              reportEdit(this.files.write(input, fileContext(toolCallId))),
            ),
          ),
      }),
      fs_write_begin: tool({
        description:
          "Начинает атомарную поэтапную запись большого файла. Вернёт sessionId и nextSequence=0. Существующий файл необходимо предварительно прочитать через fs_read.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "fs_write_begin",
            input,
            signal,
            observer,
            () => {
              const context = fileContext(toolCallId);
              const result = this.files.beginWrite(input, context);
              signal.addEventListener(
                "abort",
                () => {
                  try {
                    this.files.abortWrite(
                      { sessionId: result.sessionId },
                      context,
                    );
                  } catch {}
                },
                { once: true },
              );
              return Promise.resolve(result);
            },
          ),
      }),
      fs_write_chunk: tool({
        description:
          "Добавляет следующую часть к поэтапной записи. Передавай не более 6000 символов и точный nextSequence из результата предыдущего вызова.",
        inputSchema: z.object({
          sessionId: z.uuid(),
          sequence: z.int().nonnegative(),
          content: z.string().min(1).max(6_000),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "fs_write_chunk",
            input,
            signal,
            observer,
            () =>
              Promise.resolve(
                this.files.appendWrite(input, fileContext(toolCallId)),
              ),
          ),
      }),
      fs_write_commit: tool({
        description:
          "Атомарно завершает поэтапную запись и только после этого изменяет целевой файл.",
        inputSchema: z.object({ sessionId: z.uuid() }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "fs_write_commit",
            input,
            signal,
            observer,
            () =>
              Promise.resolve(
                reportEdit(
                  this.files.commitWrite(input, fileContext(toolCallId)),
                ),
              ),
          ),
      }),
      fs_write_abort: tool({
        description:
          "Отменяет незавершённую поэтапную запись, не изменяя целевой файл.",
        inputSchema: z.object({ sessionId: z.uuid() }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "fs_write_abort",
            input,
            signal,
            observer,
            () =>
              Promise.resolve(
                this.files.abortWrite(input, fileContext(toolCallId)),
              ),
          ),
      }),
      fs_edit: tool({
        description:
          "Заменяет фрагмент текста в файле. Фрагмент должен встречаться ровно один раз — добавь окружающие строки для однозначности либо укажи replaceAll. Возвращает diff, а не содержимое файла.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
          oldText: z.string().min(1).max(100_000),
          newText: z.string().max(100_000),
          replaceAll: z.boolean().optional(),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "fs_edit", input, signal, observer, () =>
            Promise.resolve(
              reportEdit(this.files.edit(input, fileContext(toolCallId))),
            ),
          ),
      }),
      fs_multi_edit: tool({
        description:
          "Применяет несколько правок к одному файлу атомарно: если хотя бы одна не применилась, файл не меняется вовсе.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
          edits: z
            .array(
              z.object({
                oldText: z.string().min(1).max(100_000),
                newText: z.string().max(100_000),
                replaceAll: z.boolean().optional(),
              }),
            )
            .min(1)
            .max(50),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "fs_multi_edit",
            input,
            signal,
            observer,
            () =>
              Promise.resolve(
                reportEdit(
                  this.files.multiEdit(input, fileContext(toolCallId)),
                ),
              ),
          ),
      }),
      fs_apply_patch: tool({
        description:
          "Применяет unified diff к файлу. Выгоднее fs_write при крупных правках: передаётся только изменённое.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
          patch: z.string().min(1).max(500_000),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "fs_apply_patch",
            input,
            signal,
            observer,
            () =>
              Promise.resolve(
                reportEdit(
                  this.files.applyPatch(input, fileContext(toolCallId)),
                ),
              ),
          ),
      }),
      fs_move: tool({
        description: "Перемещает или переименовывает файл.",
        inputSchema: z.object({
          from: z.string().trim().min(1).max(4096),
          to: z.string().trim().min(1).max(4096),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "fs_move", input, signal, observer, () =>
            Promise.resolve(
              reportEdit(this.files.move(input, fileContext(toolCallId))),
            ),
          ),
      }),
      fs_delete: tool({
        description:
          "Удаляет файл, перемещая его в корзину задачи. Удаление обратимо через откат правок.",
        inputSchema: z.object({
          path: z.string().trim().min(1).max(4096),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "fs_delete", input, signal, observer, () =>
            Promise.resolve(
              reportEdit(this.files.remove(input, fileContext(toolCallId))),
            ),
          ),
      }),
      read_tool_output: tool({
        description:
          "Возвращает полный результат более раннего вызова инструмента, усечённого при сжатии контекста. Передавай идентификатор вызова из подсказки об усечении.",
        inputSchema: z.object({
          toolCallId: z.string().trim().min(1).max(200),
        }),
        execute: (input, { toolCallId }) =>
          this.execute(
            toolCallId,
            "read_tool_output",
            input,
            signal,
            observer,
            () => {
              if (!runId) throw new Error("Вызов вне контекста задачи");
              return Promise.resolve({
                toolCallId: input.toolCallId,
                output: this.toolOutputs.toolCallOutput(
                  runId,
                  input.toolCallId,
                ),
              });
            },
          ),
      }),
    };
    Object.assign(tools, this.mcp.getToolSet());
    const available = Object.fromEntries(
      Object.entries(tools).filter(([id]) => {
        if (
          !isToolAllowed(id, allowedToolIds) &&
          !(id === "skills.load" && allowedSkillIds.length > 0)
        )
          return false;
        if (SECRET_GATED_TOOL_IDS.has(id))
          return (
            this.automationCatalog.toolSecretId(id, "ollamaApiKey") !==
            undefined
          );
        return true;
      }),
    );
    return Object.keys(available).length ? available : undefined;
  }

  skillCatalog(ids: string[]): string {
    const allowed = new Set(ids);
    const skills = this.automationCatalog
      .listSkills()
      .filter((item) => allowed.has(item.id) && item.status === "active");
    if (!skills.length) return "";
    return `\n\nДоступные навыки (полные инструкции загружай инструментом skills.load только когда навык релевантен):\n${skills.map((item) => `- #${item.id} ${item.name}: ${item.description}`).join("\n")}`;
  }

  selectedSkillBlock(ids: string[]): string {
    if (!ids.length) return "";
    const requested = new Set(ids);
    const skills = this.automationCatalog
      .listSkills()
      .filter((item) => requested.has(item.id) && item.status === "active");
    const missing = ids.filter(
      (id) => !skills.some((skill) => skill.id === id),
    );
    if (missing.length)
      throw new Error(`Выбранный навык недоступен: ${missing.join(", ")}`);
    return `\n\nНавыки, явно выбранные пользователем для этой задачи. Их инструкции уже загружены; обязательно следуй им, не загружай другие навыки самостоятельно:\n${skills
      .map(
        (skill) =>
          `\n--- НАВЫК: ${skill.name} (#${skill.id}) ---\n${this.skillContent.read(skill.slug)}\n--- КОНЕЦ НАВЫКА ---`,
      )
      .join("\n")}`;
  }

  createForChat(
    runId: string,
    emit: Emit,
    options: Omit<ToolRegistryOptions, "observer">,
  ) {
    return this.create({
      ...options,
      onFileChanged: (edit) => emit({ type: "file.changed", runId, edit }),
      observer: {
        requested: ({ callId, toolId, input }) => {
          const id = this.toolCalls.createToolCall(
            runId,
            callId,
            toolId,
            riskOf(toolId, input),
            input,
            "requested",
          );
          emit({
            type: "tool.requested",
            runId,
            toolCallId: id,
            toolId,
            input,
          });
          return id;
        },
        running: ({ toolId }, id) =>
          emit({ type: "tool.running", runId, toolCallId: id, toolId }),
        completed: ({ toolId }, id, output) => {
          this.toolCalls.finishToolCall(id, "completed", output);
          emit({
            type: "tool.completed",
            runId,
            toolCallId: id,
            toolId,
            output,
          });
        },
        failed: ({ toolId }, id, error) => {
          this.toolCalls.finishToolCall(id, "failed", undefined, error);
          emit({
            type: "tool.completed",
            runId,
            toolCallId: id,
            toolId,
            error,
          });
        },
      } satisfies ToolExecutionObserver<string>,
    });
  }

  cleanupRun(runId: string): void {
    this.files.forgetRun(runId);
  }

  forgetConversation(conversationId: string): void {
    this.files.forgetConversation(conversationId);
    this.reports.abortConversation(conversationId);
  }

  private async execute(
    callId: string,
    toolId: string,
    input: unknown,
    signal: AbortSignal,
    observer: ToolExecutionObserver | undefined,
    action: () => Promise<unknown>,
  ) {
    const event = { callId, toolId, input };
    const reference = observer?.requested(event);
    try {
      if (signal.aborted) throw new Error("Выполнение отменено");
      observer?.running?.(event, reference);
      const output = await action();
      observer?.completed?.(event, reference, output);
      return output;
    } catch (error) {
      observer?.failed?.(event, reference, errorMessage(error));
      throw error;
    }
  }
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const READ_ONLY_TOOL_IDS = new Set([
  "fs_read",
  "fs_list",
  "grep_search",
  "regexp_search",
  "vecdb_search",
  "memory_search",
  "read_tool_output",
  "skills.load",
  "tasks_plan",
  "ask_user",
]);

export function filterToolIdsByPermission(
  toolIds: string[],
  mode: PermissionMode | undefined,
): string[] {
  if (!mode || mode === "edit") return toolIds;
  if (mode === "deny") return [];
  return toolIds.filter((id) => READ_ONLY_TOOL_IDS.has(id));
}

export const FILE_TOOL_IDS = new Set([
  "fs_read",
  "fs_list",
  "fs_write",
  "fs_write_begin",
  "fs_write_chunk",
  "fs_write_commit",
  "fs_write_abort",
  "fs_edit",
  "fs_multi_edit",
  "fs_apply_patch",
  "fs_move",
  "fs_delete",
]);

const WRITE_TOOL_IDS = new Set([
  "reports_docx",
  "reports_begin",
  "reports_add_blocks",
  "reports_commit",
  "reports_abort",
  "memory_save",
  "tasks_plan",
  "fs_write",
  "fs_write_begin",
  "fs_write_chunk",
  "fs_write_commit",
  "fs_write_abort",
  "fs_edit",
  "fs_multi_edit",
  "fs_apply_patch",
  "fs_move",
]);
const DESTRUCTIVE_TOOL_IDS = new Set(["fs_delete"]);

const STAGED_FILE_TOOL_IDS = new Set([
  "fs_write_begin",
  "fs_write_chunk",
  "fs_write_commit",
  "fs_write_abort",
]);
const STAGED_REPORT_TOOL_IDS = new Set([
  "reports_begin",
  "reports_add_blocks",
  "reports_commit",
  "reports_abort",
]);

const SECRET_GATED_TOOL_IDS = new Set(["web_search", "web_fetch"]);

function isToolAllowed(toolId: string, allowedToolIds: string[]): boolean {
  if (allowedToolIds.includes(toolId)) return true;
  if (STAGED_FILE_TOOL_IDS.has(toolId))
    return allowedToolIds.includes("fs_write");
  if (STAGED_REPORT_TOOL_IDS.has(toolId))
    return allowedToolIds.includes("reports_docx");
  return false;
}

function reportBlockSchema() {
  return z.discriminatedUnion("type", [
    z.object({
      type: z.literal("heading"),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      text: z.string().trim().min(1).max(500),
      numbered: z.boolean().optional(),
    }),
    z.object({
      type: z.literal("paragraph"),
      paragraphs: z.array(z.string().trim().min(1).max(1_000)).min(1).max(4),
    }),
    z.object({
      type: z.literal("list"),
      style: z.enum(["bullet", "numbered"]),
      items: z.array(z.string().trim().min(1).max(400)).min(1).max(10),
    }),
    z.object({
      type: z.literal("table"),
      number: z.string().trim().max(30).optional(),
      title: z.string().trim().min(1).max(500),
      headers: z.array(z.string().max(200)).min(1).max(10),
      rows: z.array(z.array(z.string().max(200)).max(10)).max(5),
    }),
    z.object({
      type: z.literal("code"),
      number: z.string().trim().max(30).optional(),
      title: z.string().trim().min(1).max(500),
      language: z.string().trim().max(50).optional(),
      content: z.string().max(4_000),
    }),
    z.object({ type: z.literal("pageBreak") }),
  ]);
}

function riskOf(toolId: string, input: unknown): string {
  if (toolId !== "cmd_exec") {
    if (DESTRUCTIVE_TOOL_IDS.has(toolId)) return "delete";
    return WRITE_TOOL_IDS.has(toolId) ? "write" : "read";
  }
  const payload = input as { action?: string; script?: string } | undefined;
  if (payload?.action !== "start") return "read";
  const permission = maxPermission(extractCommandNames(payload.script ?? ""));
  if (permission === "delete") return "delete";
  if (permission === "read") return "read";
  return "write";
}
