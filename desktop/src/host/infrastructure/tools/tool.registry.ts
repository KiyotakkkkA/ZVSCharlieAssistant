import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { RunEvent } from "../../../ipc/contracts";
import type { SecretStorageRepository } from "../../domain/repositories/secret-storage.repository";
import type { AutomationDataSource } from "../database/automation.data-source";
import type { ChatDataSource } from "../database/chat.data-source";
import type { VectorStoreService } from "../vector-store/vector-store.service";

type Emit = (event: RunEvent) => void;

export class ToolRegistry {
  constructor(
    private readonly chatData: ChatDataSource,
    private readonly automationData: AutomationDataSource,
    private readonly secrets: SecretStorageRepository,
    private readonly vectorStores: VectorStoreService,
  ) {}

  create(
    runId: number,
    emit: Emit,
    signal: AbortSignal,
    allowed: string[],
    allowedVectorStoreIds: number[] = [],
    retrievalLimit = 5,
  ): ToolSet {
    const tools: ToolSet = {
      "web.search": tool({
        description:
          "Ищет актуальную информацию в интернете и возвращает источники с заголовком, URL и фрагментом содержимого.",
        inputSchema: z.object({
          query: z.string().trim().min(1).max(500),
        }),
        execute: async (input, { toolCallId }) =>
          this.execute(
            runId,
            toolCallId,
            "web.search",
            input,
            emit,
            signal,
            () => this.callOllama("web.search", input, signal),
          ),
      }),
      "web.fetch": tool({
        description:
          "Получает веб-страницу и возвращает её заголовок, Markdown-содержимое и найденные ссылки.",
        inputSchema: z.object({
          url: z.string().trim().min(1).max(4096),
        }),
        execute: async (input, { toolCallId }) =>
          this.execute(
            runId,
            toolCallId,
            "web.fetch",
            input,
            emit,
            signal,
            () => this.callOllama("web.fetch", input, signal),
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
        execute: async (input, { toolCallId }) =>
          this.execute(
            runId,
            toolCallId,
            "vecdb.search",
            input,
            emit,
            signal,
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
    return Object.fromEntries(
      Object.entries(tools).filter(
        ([id]) =>
          allowed.includes(id) &&
          (id === "vecdb.search" ||
            this.automationData.toolSecretId(id, "ollamaApiKey") !== undefined),
      ),
    );
  }

  private async callOllama(
    toolId: "web.search" | "web.fetch",
    body: { query: string } | { url: string },
    signal: AbortSignal,
  ) {
    const secretId = this.automationData.toolSecretId(toolId, "ollamaApiKey");
    const apiKey = secretId
      ? this.secrets.getSecret(secretId)?.content.trim()
      : "";
    if (!apiKey)
      throw new Error(`Для инструмента «${toolId}» не настроен Ollama API key`);
    const endpoint = toolId.replace(".", "_");
    const response = await fetch(`https://ollama.com/api/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(
        `Ollama ${toolId} вернул ${response.status}${details ? `: ${details}` : ""}`,
      );
    }
    return response.json() as Promise<unknown>;
  }

  private async execute(
    runId: number,
    callId: string,
    toolId: string,
    input: unknown,
    emit: Emit,
    signal: AbortSignal,
    action: () => Promise<unknown>,
  ) {
    const id = this.chatData.createToolCall(
      runId,
      callId,
      toolId,
      "read",
      input,
      "requested",
    );
    emit({ type: "tool.requested", runId, toolCallId: id, toolId, input });
    if (signal.aborted) throw new Error("Выполнение отменено");
    emit({ type: "tool.running", runId, toolCallId: id, toolId });
    try {
      const output = await action();
      this.chatData.finishToolCall(id, "completed", output);
      emit({ type: "tool.completed", runId, toolCallId: id, toolId, output });
      return output;
    } catch (error) {
      this.chatData.finishToolCall(
        id,
        "failed",
        undefined,
        error instanceof Error ? error.message : String(error),
      );
      emit({
        type: "tool.completed",
        runId,
        toolCallId: id,
        toolId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
