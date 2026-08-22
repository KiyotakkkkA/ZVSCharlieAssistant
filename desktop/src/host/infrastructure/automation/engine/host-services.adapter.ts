import { generateObject as aiGenerateObject, stepCountIs, streamText, type ToolSet } from "ai";
import { ScenarioSuspended as SharedScenarioSuspended } from "../../../../shared/scenario/errors";
import { PermanentError } from "../../../../shared/scenario/errors";
import type { ScenarioFileReference } from "../../../../shared/dto/scenario-trigger-event.dto";
import type { ScenarioExecutionRepository } from "../../database/scenario-execution.repository";
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

export class HostScenarioEngineServices implements ScenarioEngineServices {
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
    private readonly runSubScenarioEngine?: () => ScenarioRuntimeEngine,
  ) {}

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
    const settings = this.providers.generationSettings(request.modelId);
    const result = streamText({
      model: this.providers.resolve(request.modelId),
      system: request.system,
      prompt:
        typeof request.prompt === "string"
          ? request.prompt
          : JSON.stringify(request.prompt),
      abortSignal: request.signal,
      maxOutputTokens: Math.min(request.maxOutputTokens, settings.maxOutputTokens),
      temperature: request.temperature ?? settings.temperature,
      topP: request.topP ?? settings.topP,
      tools: request.tools,
      stopWhen: request.tools ? stepCountIs(request.maxToolCalls ?? 10) : undefined,
    });
    let text = "";
    for await (const delta of result.textStream) {
      text += delta;
      request.onDelta?.(delta);
    }
    return text;
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

  async downloadFiles(request: DownloadFilesRequest): Promise<DownloadedFile[]> {
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
      output: request.output,
    });
  }

  async runSubScenario(request: RunSubScenarioRequest): Promise<unknown> {
    if (!this.runSubScenarioEngine)
      throw new PermanentError("Запуск вложенных сценариев недоступен", {});
    const engine = this.runSubScenarioEngine();
    return new Promise((resolve, reject) => {
      const run = engine.start(request.scenarioId, request.input, "background", (event) => {
        if (event.type === "run.completed") resolve(event.run.output);
        else if (event.type === "run.failed")
          reject(new Error(event.run.error ?? "Вложенный сценарий завершился с ошибкой"));
        else if (event.type === "run.cancelled")
          reject(new Error("Вложенный сценарий отменён"));
      });
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
