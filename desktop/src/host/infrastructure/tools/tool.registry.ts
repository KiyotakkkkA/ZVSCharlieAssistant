import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { RunEvent } from "../../../ipc/contracts";
import type { AutomationDataSource } from "../database/automation.data-source";
import type { ChatDataSource } from "../database/chat.data-source";
import type { VectorStoreService } from "../vector-store/vector-store.service";
import { OllamaWebService } from "./ollama-web.service";

type Emit = (event: RunEvent) => void;

export interface ToolExecutionEvent {
  callId: string;
  toolId: string;
  input: unknown;
}

export interface ToolExecutionObserver<TReference = unknown> {
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

export interface ToolRegistryOptions {
  signal: AbortSignal;
  allowedToolIds: string[];
  allowedVectorStoreIds?: number[];
  retrievalLimit?: number;
  observer?: ToolExecutionObserver;
}

export class ToolRegistry {
  constructor(
    private readonly chatData: ChatDataSource,
    private readonly automationData: AutomationDataSource,
    private readonly web: OllamaWebService,
    private readonly vectorStores: VectorStoreService,
  ) {}

  create(options: ToolRegistryOptions): ToolSet | undefined {
    const {
      signal,
      allowedToolIds,
      allowedVectorStoreIds = [],
      retrievalLimit = 5,
      observer,
    } = options;
    const tools: ToolSet = {
      "web.search": tool({
        description:
          "Ищет актуальную информацию в интернете и возвращает источники с заголовком, URL и фрагментом содержимого.",
        inputSchema: z.object({ query: z.string().trim().min(1).max(500) }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "web.search", input, signal, observer, () =>
            this.web.execute("web.search", input, signal),
          ),
      }),
      "web.fetch": tool({
        description:
          "Получает веб-страницу и возвращает её заголовок, Markdown-содержимое и найденные ссылки.",
        inputSchema: z.object({ url: z.string().trim().min(1).max(4096) }),
        execute: (input, { toolCallId }) =>
          this.execute(toolCallId, "web.fetch", input, signal, observer, () =>
            this.web.execute("web.fetch", input, signal),
          ),
      }),
      "vecdb.search": tool({
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
            "vecdb.search",
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
    };
    const available = Object.fromEntries(
      Object.entries(tools).filter(
        ([id]) =>
          allowedToolIds.includes(id) &&
          (id === "vecdb.search" ||
            this.automationData.toolSecretId(id, "ollamaApiKey") !== undefined),
      ),
    );
    return Object.keys(available).length ? available : undefined;
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
          const id = this.chatData.createToolCall(
            runId,
            callId,
            toolId,
            "read",
            input,
            "requested",
          );
          emit({ type: "tool.requested", runId, toolCallId: id, toolId, input });
          return id;
        },
        running: ({ toolId }, id) =>
          emit({ type: "tool.running", runId, toolCallId: id, toolId }),
        completed: ({ toolId }, id, output) => {
          this.chatData.finishToolCall(id, "completed", output);
          emit({ type: "tool.completed", runId, toolCallId: id, toolId, output });
        },
        failed: ({ toolId }, id, error) => {
          this.chatData.finishToolCall(id, "failed", undefined, error);
          emit({ type: "tool.completed", runId, toolCallId: id, toolId, error });
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
