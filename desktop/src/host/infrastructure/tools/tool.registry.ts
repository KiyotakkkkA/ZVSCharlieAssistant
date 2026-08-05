import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { RunEvent } from "../../../shared/models/chat";
import type {
  AutomationRuntimeCatalog,
  SkillContentStore,
  ToolCallRecorder,
} from "../../application/ports/automation-runtime.ports";
import type { VectorStoreService } from "../vector-store/vector-store.service";
import { OllamaWebService } from "./ollama-web.service";
import type { ReportDocxService } from "./report-docx.service";
import type { AgentTerminalPolicy } from "../../../shared/models/terminal";
import type { CommandExecutionService } from "./command-execution.service";

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
  allowedVectorStoreIds?: number[];
  retrievalLimit?: number;
  allowedSkillIds?: number[];
  terminalPolicy?: AgentTerminalPolicy;
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
            timeoutSeconds: z.number().int().min(1).max(86_400).optional(),
          }),
          z.object({
            action: z.enum(["status", "output", "wait", "cancel"]),
            sessionId: z.string().uuid(),
            timeoutSeconds: z.number().int().min(1).max(30).optional(),
          }),
        ]),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "cmd_exec", input, signal, observer, () => {
            if (!terminalPolicy) throw new Error("Политика терминала агента не настроена");
            return this.commands.execute(input, terminalPolicy, signal);
          }),
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
          storeIds: z.array(z.number().int().positive()).optional(),
          limit: z.number().int().min(1).max(20).optional(),
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
        inputSchema: z.object({ skillId: z.number().int().positive() }),
        execute: ({ skillId }) => {
          if (!allowedSkillIds.includes(skillId))
            throw new Error("Навык не назначен агенту");
          const skill = this.automationCatalog
            .listSkills()
            .find((item) => item.id === skillId && item.status === "active");
          if (!skill) throw new Error("Навык недоступен");
          return {
            id: skill.id,
            name: skill.name,
            instructions: this.skillContent.read(skill.slug),
          };
        },
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
            id === "vecdb_search" ||
            id === "skills.load" ||
            id === "reports_docx" ||
            this.automationCatalog.toolSecretId(id, "ollamaApiKey") !==
              undefined),
      ),
    );
    return Object.keys(available).length ? available : undefined;
  }

  skillCatalog(ids: number[]): string {
    const allowed = new Set(ids);
    const skills = this.automationCatalog
      .listSkills()
      .filter((item) => allowed.has(item.id) && item.status === "active");
    if (!skills.length) return "";
    return `\n\nДоступные навыки (полные инструкции загружай инструментом skills.load только когда навык релевантен):\n${skills.map((item) => `- #${item.id} ${item.name}: ${item.description}`).join("\n")}`;
  }

  createForChat(
    runId: number,
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
            "read",
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
      } satisfies ToolExecutionObserver<number>,
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
