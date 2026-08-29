import {
  generateObject as aiGenerateObject,
  stepCountIs,
  streamText,
  type ToolSet,
} from "ai";
import { ScenarioSuspended as SharedScenarioSuspended } from "../../../../shared/scenario/errors";
import { PermanentError } from "../../../../shared/scenario/errors";
import type { ScenarioFileReference } from "../../../../shared/dto/scenario-trigger-event.dto";
import type { ScenarioBinaryRef } from "../../../../shared/scenario/items";
import type { ChatMessageContentPart, JsonValue } from "../../../../shared/dto";
import type { ScenarioExecutionRepository } from "../../database/scenario-execution.repository";
import type { ScenarioAgentConversationRepository } from "../../database/scenario-agent-conversation.repository";
import type { ProviderRegistry } from "../../text-generation/provider.registry";
import type { ToolRegistry } from "../../tools/tool.registry";
import type { VectorStoreService } from "../../vector-store/vector-store.service";
import type { SecretStorageRepository } from "../../database/secret-storage.repository";
import type { ScenarioFileDownloadService } from "../scenario-file-download.service";
import type { ScenarioFileReaderService } from "../scenario-file-reader.service";
import type { ScenarioResponseService } from "../scenario-response.service";
import {
  ScenarioSuspended as HostScenarioSuspended,
  type UserQuestionService,
} from "../../../application/services/user-question.service";
import {
  ModelFailover,
  type ModelDirectory,
} from "../../text-generation/model-failover";
import { resolveContextBudget } from "../../../application/context/context-budget";
import type { EnabledModelInfo } from "../../../application/context/generation-context";
import { DurableAgentContext } from "./durable-agent-context";
import type { ScenarioRuntimeEngine } from "./scenario-runtime-engine";
import type {
  AskApprovalRequest,
  CreateToolsRequest,
  DeliverResponseRequest,
  DownloadFilesRequest,
  DownloadedFile,
  GenerateObjectRequest,
  GenerateTextRequest,
  KnowledgeChunk,
  ReadFilesResult,
  RunSubScenarioRequest,
  ScenarioAgentRecord,
  ScenarioEngineServices,
} from "./services";

const MAX_TOTAL_STEPS = 40;
const REPORT_FILE_TOOL_IDS = new Set(["reports_docx", "reports_commit"]);

interface GenerationStreamPart {
  type: string;
  text?: string;
  error?: unknown;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
}

export class HostScenarioEngineServices implements ScenarioEngineServices {
  private readonly failover: ModelFailover;
  private readonly listEnabledModels: () => EnabledModelInfo[];

  constructor(
    private readonly data: ScenarioExecutionRepository,
    private readonly providers: ProviderRegistry,
    private readonly toolRegistry: ToolRegistry,
    private readonly vectorStores: VectorStoreService,
    private readonly secrets: SecretStorageRepository,
    private readonly fileDownloads: ScenarioFileDownloadService,
    private readonly fileReader: ScenarioFileReaderService,
    private readonly responses: ScenarioResponseService,
    private readonly questions: UserQuestionService,
    private readonly agentConversations: ScenarioAgentConversationRepository,
    listEnabledModels: () => EnabledModelInfo[],
    private readonly runSubScenarioEngine?: () => ScenarioRuntimeEngine,
  ) {
    this.listEnabledModels = listEnabledModels;
    const directory: ModelDirectory = {
      listEnabledTextModels: () => this.listEnabledModels(),
      recordModelSwitch: () => {},
    };
    this.failover = new ModelFailover(directory, this.providers);
  }

  defaultModelId(): string | null {
    return this.data.defaultModelId() ?? null;
  }

  agent(agentId: string): ScenarioAgentRecord | undefined {
    const record = this.data.agent(agentId);
    if (!record) return undefined;
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      instructions: record.instructions,
      textModelId: record.text_model_id ?? null,
      allowedToolIds: record.allowedToolIds,
      allowedVectorStoreIds: record.allowedVectorStoreIds,
      allowedSkillIds: record.allowedSkillIds,
      retrievalLimit: record.retrieval_limit,
      maxToolCalls: record.max_tool_calls,
      timeoutSeconds: record.timeout_seconds,
      terminalPolicy: record.terminalPolicy,
      directoryPolicy: record.directoryPolicy,
    };
  }

  async generateText(request: GenerateTextRequest): Promise<string> {
    const context = DurableAgentContext.loadOrCreate(
      this.agentConversations,
      request.runId,
      request.nodeId,
      request.modelId,
    );
    if (!context.isResumed)
      context.appendUser([
        {
          type: "text",
          text:
            typeof request.prompt === "string"
              ? request.prompt
              : JSON.stringify(request.prompt),
        },
      ]);

    let activeModelId = context.activeModelId;
    let toolSteps = 0;
    const maxToolCalls = request.maxToolCalls ?? 10;

    for (let step = 0; step < MAX_TOTAL_STEPS; step += 1) {
      let compacted = false;
      let assistantParts: ChatMessageContentPart[] = [];
      let resultParts: ChatMessageContentPart[] = [];
      let textAccum = "";
      let hadToolCalls = false;
      const allowTools = Boolean(request.tools) && toolSteps < maxToolCalls;

      for (let attempt = 0; ; ) {
        const settings = this.providers.generationSettings(activeModelId);
        const budget = resolveContextBudget({
          contextLength: this.providers.modelInfo(activeModelId).contextLength,
          maxOutputTokens: Math.min(
            request.maxOutputTokens,
            settings.maxOutputTokens,
          ),
        });
        await context.compactIfNeeded(
          request.system,
          budget,
          {
            providers: this.providers,
            listEnabledModels: this.listEnabledModels,
            summarizerModelId: activeModelId,
            reason: compacted ? "overflow" : "threshold",
          },
          compacted,
        );
        const built = context.compactor.buildStepContext(
          request.system,
          budget,
        );

        assistantParts = [];
        resultParts = [];
        textAccum = "";
        const toolCallParts: ChatMessageContentPart[] = [];

        try {
          const result = streamText({
            model: this.providers.resolve(activeModelId),
            system: request.system,
            messages: built.messages,
            tools: allowTools ? request.tools : undefined,
            stopWhen: stepCountIs(1),
            abortSignal: request.signal,
            maxOutputTokens: Math.min(
              request.maxOutputTokens,
              settings.maxOutputTokens,
            ),
            temperature: request.temperature ?? settings.temperature,
            topP: request.topP ?? settings.topP,
          });
          for await (const raw of result.stream) {
            const part = raw as unknown as GenerationStreamPart;
            if (part.type === "error") {
              throw normalizeStreamError(part.error);
            } else if (part.type === "text-delta") {
              textAccum += part.text ?? "";
              request.onDelta?.(part.text ?? "");
            } else if (part.type === "tool-call") {
              toolCallParts.push({
                type: "tool-call",
                toolCallId: part.toolCallId ?? "",
                toolName: part.toolName ?? "",
                input: (part.input ?? null) as JsonValue,
              });
            } else if (part.type === "tool-result") {
              resultParts.push({
                type: "tool-result",
                toolCallId: part.toolCallId ?? "",
                toolName: part.toolName ?? "",
                output: (part.output ?? null) as JsonValue,
              });
            } else if (part.type === "tool-error") {
              resultParts.push({
                type: "tool-result",
                toolCallId: part.toolCallId ?? "",
                toolName: part.toolName ?? "",
                output: errorToJson(part.error),
                isError: true,
              });
            }
          }
          if (textAccum.trim())
            assistantParts.push({ type: "text", text: textAccum });
          assistantParts.push(...toolCallParts);
          hadToolCalls = toolCallParts.length > 0;
          break;
        } catch (error) {
          const decision = this.failover.decide(error, {
            activeModelId,
            attempt,
            compacted,
          });
          if (decision.kind === "fail") {
            context.markFailed();
            throw error;
          }
          if (decision.kind === "retry") {
            attempt += 1;
            await delay(decision.delayMs);
            continue;
          }
          if (decision.kind === "compact") {
            compacted = true;
            continue;
          }
          activeModelId = decision.modelId;
          context.switchModel(activeModelId);
          attempt = 0;
        }
      }

      if (assistantParts.length || resultParts.length)
        context.appendAssistant([...assistantParts, ...resultParts]);

      for (const part of resultParts) {
        if (
          part.type !== "tool-result" ||
          part.isError ||
          !REPORT_FILE_TOOL_IDS.has(part.toolName)
        )
          continue;
        const output = part.output as
          | { path?: unknown; fileName?: unknown }
          | null
          | undefined;
        if (
          !output ||
          typeof output.path !== "string" ||
          typeof output.fileName !== "string"
        )
          continue;
        try {
          const ref = await this.fileDownloads.registerGeneratedFile({
            executionId: request.runId,
            nodeRunId: request.nodeRunId,
            nodeId: request.nodeId,
            sourcePath: output.path,
            fileName: output.fileName,
          });
          request.onGeneratedFile?.(ref as ScenarioBinaryRef);
        } catch {}
      }

      if (hadToolCalls) {
        toolSteps += 1;
        continue;
      }
      context.markCompleted();
      return textAccum;
    }

    throw new PermanentError(
      "Модель не завершила ответ за отведённое число шагов",
      { context: { nodeId: request.nodeId } },
    );
  }

  async generateObject<T>(request: GenerateObjectRequest<T>): Promise<T> {
    const settings = this.providers.generationSettings(request.modelId);
    const result = await aiGenerateObject({
      model: this.providers.resolve(request.modelId),
      system: request.system,
      prompt:
        typeof request.prompt === "string"
          ? request.prompt
          : JSON.stringify(request.prompt),
      abortSignal: request.signal,
      schema: request.schema,
      maxOutputTokens: Math.min(
        request.maxOutputTokens ?? settings.maxOutputTokens,
        settings.maxOutputTokens,
      ),
      temperature: settings.temperature,
      topP: settings.topP,
    });
    return result.object;
  }

  createTools(request: CreateToolsRequest): ToolSet | undefined {
    return this.toolRegistry.create({
      signal: request.signal,
      allowedToolIds: request.allowedToolIds,
      allowedVectorStoreIds: request.allowedVectorStoreIds,
      retrievalLimit: request.retrievalLimit,
      allowedSkillIds: request.allowedSkillIds,
      terminalPolicy: request.terminalPolicy,
      directoryPolicy: request.directoryPolicy,
      observer: request.onToolResult
        ? {
            requested: () => undefined,
            completed: (event, _reference, output) =>
              request.onToolResult?.(event.toolId, event.input, output),
          }
        : undefined,
    });
  }

  async searchKnowledge(input: {
    vectorStoreIds: string[];
    query: string;
    limit: number;
    minScore?: number;
  }): Promise<KnowledgeChunk[]> {
    const results = await this.vectorStores.search({
      vectorStoreIds: input.vectorStoreIds,
      query: input.query,
      limit: input.limit,
      scoreThreshold: input.minScore,
    });
    return results.map((item) => ({
      documentId: item.documentId,
      chunkIndex: item.chunkIndex,
      fileName: item.fileName,
      content: item.content,
      score: item.score,
      pageNumber: item.pageNumber ?? null,
    }));
  }

  httpFetch: typeof fetch = (...args) => fetch(...args);

  secret(secretId: string): string | undefined {
    return this.secrets.findSecret(secretId)?.content;
  }

  async downloadFiles(
    request: DownloadFilesRequest,
  ): Promise<DownloadedFile[]> {
    const files = await this.fileDownloads.downloadForNode({
      executionId: request.executionId,
      nodeRunId: request.nodeRunId,
      nodeId: request.nodeId,
      value: request.value,
      cleanupOnFinish: false,
      maxFileSizeBytes: request.maxFileSizeBytes,
      signal: request.signal,
    });
    return files.slice(0, request.maxFiles);
  }

  async readFiles(input: {
    files: ScenarioFileReference[];
    maxCharactersPerFile: number;
  }): Promise<ReadFilesResult> {
    return this.fileReader.read(input.files, input.maxCharactersPerFile);
  }

  deliverResponse(request: DeliverResponseRequest): void {
    this.responses.enqueue({
      executionId: request.executionId,
      nodeId: "",
      nodeRunId: request.nodeRunId,
      config: request.config,
      triggerInput: request.triggerInput,
      attachments: request.attachments,
      output: request.output,
    });
  }

  async runSubScenario(request: RunSubScenarioRequest): Promise<unknown> {
    if (!this.runSubScenarioEngine)
      throw new PermanentError("Запуск вложенных сценариев недоступен", {});
    const engine = this.runSubScenarioEngine();
    return new Promise((resolve, reject) => {
      const run = engine.start(
        request.scenarioId,
        request.input,
        "background",
        (event) => {
          if (event.type === "run.completed") resolve(event.run.output);
          else if (event.type === "run.failed")
            reject(
              new Error(
                event.run.error ?? "Вложенный сценарий завершился с ошибкой",
              ),
            );
          else if (event.type === "run.cancelled")
            reject(new Error("Вложенный сценарий отменён"));
        },
      );
      if (request.mode === "fireAndForget") resolve(run);
    });
  }

  askApproval(request: AskApprovalRequest): { answer: string[] } {
    try {
      const answer = this.questions.askInScenario(
        {
          mode: request.mode,
          header: request.header,
          question: request.question,
          options: request.options,
          multiSelect: request.multiSelect,
          defaultAnswer: request.defaultAnswer,
          timeoutSeconds: request.timeoutSeconds,
        },
        {
          executionId: request.executionId,
          nodeId: request.nodeId,
          nodeRunId: request.nodeRunId,
          triggerInput: request.triggerInput,
        },
      );
      return { answer };
    } catch (error) {
      if (error instanceof HostScenarioSuspended)
        throw new SharedScenarioSuspended(error.questionId, request.nodeId);
      throw error;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToJson(error: unknown): JsonValue {
  if (error instanceof Error) return { error: error.message };
  if (typeof error === "string") return { error };
  return { error: "Инструмент завершился с ошибкой" };
}

function normalizeStreamError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim())
      return Object.assign(new Error(message, { cause: error }), error);
  }
  return new Error("Ошибка при обращении к модели");
}
