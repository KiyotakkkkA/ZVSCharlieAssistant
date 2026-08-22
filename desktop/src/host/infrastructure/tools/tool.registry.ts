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
} from "../../../shared/dto";
import type { CommandExecutionService } from "./command-execution.service";
import type { NativeSearchService } from "./native-search.service";
import type { MemoryService } from "../../application/services/memory.service";
import type { TaskPlanRepository } from "../database/task-plan.repository";
import type { UserQuestionService } from "../../application/services/user-question.service";

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
  observer?: ToolExecutionObserver;
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
    } = options;
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
            sessionId: z.string().uuid(),
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
              return this.search.entitySearch(input, directoryPolicy);
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
              return this.search.regexpSearch(input, directoryPolicy);
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
              );
              return { answer };
            },
          ),
      }),
      reports_docx: tool({
        description:
          "Создаёт единый DOCX-файл из структурированных блоков по шаблону оформления РТУ МИРЭА/ГОСТ 7.32–2017. Передавай весь документ за один вызов.",
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
            .max(2_000),
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
    };
    const available = Object.fromEntries(
      Object.entries(tools).filter(
        ([id]) =>
          (allowedToolIds.includes(id) ||
            (id === "skills.load" && allowedSkillIds.length > 0)) &&
          (id === "cmd_exec" ||
            id === "tasks_plan" ||
            id === "memory_search" ||
            id === "memory_save" ||
            id === "ask_user" ||
            id === "grep_search" ||
            id === "regexp_search" ||
            id === "vecdb_search" ||
            id === "skills.load" ||
            id === "reports_docx" ||
            this.automationCatalog.toolSecretId(id, "ollamaApiKey") !==
              undefined),
      ),
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

  createForChat(
    runId: string,
    emit: Emit,
    options: Omit<ToolRegistryOptions, "observer">,
  ) {
    return this.create({
      ...options,
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

const WRITE_TOOL_IDS = new Set(["reports_docx", "memory_save", "tasks_plan"]);

function riskOf(toolId: string, input: unknown): string {
  if (toolId !== "cmd_exec")
    return WRITE_TOOL_IDS.has(toolId) ? "write" : "read";
  const payload = input as { action?: string; script?: string } | undefined;
  if (payload?.action !== "start") return "read";
  const script = payload.script ?? "";
  if (/\b(Remove-Item|Clear-Content|Remove-ItemProperty)\b/i.test(script))
    return "delete";
  if (
    /\b(Set-Content|Add-Content|New-Item|Move-Item|Copy-Item|Rename-Item|Out-File)\b/i.test(
      script,
    )
  )
    return "write";
  return "read";
}
