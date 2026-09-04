import type { ToolSet } from "ai";
import type { z } from "zod";
import type {
  AgentDirectoryPolicy,
  AgentTerminalPolicy,
} from "../../../../shared/dto";
import type { ScenarioFileReference } from "../../../../shared/dto/scenario-trigger-event.dto";
import type { ScenarioBinaryRef } from "../../../../shared/scenario/items";

export interface GenerateTextRequest {
  runId: string;
  nodeId: string;
  nodeRunId: string;
  modelId: string;
  system: string;
  prompt: unknown;
  signal: AbortSignal;
  maxOutputTokens: number;
  temperature?: number | null;
  topP?: number | null;
  tools?: ToolSet;
  maxToolCalls?: number;
  onDelta?(delta: string): void;
  onGeneratedFile?(ref: ScenarioBinaryRef): void;
}

export interface GenerateObjectRequest<T> {
  runId: string;
  nodeId: string;
  modelId: string;
  system: string;
  prompt: unknown;
  signal: AbortSignal;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}

export interface KnowledgeChunk {
  documentId: string;
  chunkIndex: number;
  fileName: string;
  content: string;
  score: number;
  pageNumber: number | null;
}

export interface ScenarioAgentRecord {
  id: string;
  name: string;
  description: string;
  instructions: string;
  textModelId: string | null;
  allowedToolIds: string[];
  allowedVectorStoreIds: string[];
  allowedSkillIds: string[];
  retrievalLimit: number;
  maxToolCalls: number;
  timeoutSeconds: number;
  terminalPolicy: AgentTerminalPolicy;
  directoryPolicy: AgentDirectoryPolicy;
}

export interface CreateToolsRequest {
  signal: AbortSignal;
  allowedToolIds: string[];
  allowedVectorStoreIds: string[];
  retrievalLimit: number;
  allowedSkillIds: string[];
  terminalPolicy?: AgentTerminalPolicy;
  directoryPolicy?: AgentDirectoryPolicy;
  onToolResult?(toolId: string, input: unknown, output: unknown): void;
}

export interface DownloadFilesRequest {
  executionId: string;
  nodeRunId: string;
  nodeId: string;
  value: unknown;
  maxFileSizeBytes: number;
  maxFiles: number;
  cleanupOnFinish: boolean;
  signal: AbortSignal;
}

export interface DownloadedFile {
  id: string;
  fileName: string;
  mimeType: string | null;
  size: number;
  sha256: string;
  storageKey: string;
}

export interface ReadFilesResult {
  documents: Array<{
    fileId: string;
    fileName: string;
    mimeType: string | null;
    text: string;
    truncated: boolean;
  }>;
  unsupportedFiles: Array<{ fileId: string; fileName: string }>;
}

export interface DeliverResponseRequest {
  executionId: string;
  nodeId: string;
  nodeRunId: string;
  config: unknown;
  triggerInput: unknown;
  output: unknown;
  attachments: ScenarioBinaryRef[];
}

export interface RunSubScenarioRequest {
  scenarioId: string;
  input: unknown;
  signal: AbortSignal;
  mode: "await" | "fireAndForget";
}

export interface AskApprovalRequest {
  executionId: string;
  nodeId: string;
  nodeRunId: string;
  triggerInput: unknown;
  mode: "confirm" | "choice" | "text";
  header: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  defaultAnswer: string | null;
  timeoutSeconds: number | null;
  channel: "ui" | "trigger" | "telegram" | "email";
  integrationProfileId: string | null;
  recipient: string;
}

export interface EffectRequest {
  executionId: string;
  nodeId: string;
  iteration: number;
  kind: string;
  payload: unknown;
}

export interface ScenarioEngineServices {
  defaultModelId(): string | null;
  agent(agentId: string): ScenarioAgentRecord | undefined;

  generateText(request: GenerateTextRequest): Promise<string>;
  generateObject<T>(request: GenerateObjectRequest<T>): Promise<T>;

  createTools(request: CreateToolsRequest): ToolSet | undefined;

  searchKnowledge(input: {
    vectorStoreIds: string[];
    query: string;
    limit: number;
    minScore?: number;
  }): Promise<KnowledgeChunk[]>;

  httpFetch: typeof fetch;
  secret(secretId: string): string | undefined;

  downloadFiles(request: DownloadFilesRequest): Promise<DownloadedFile[]>;
  readFiles(input: {
    files: ScenarioFileReference[];
    maxCharactersPerFile: number;
  }): Promise<ReadFilesResult>;

  effectOnce<T>(
    request: EffectRequest,
    perform: () => Promise<T> | T,
  ): Promise<T>;

  deliverResponse(request: DeliverResponseRequest): void;
  runSubScenario(request: RunSubScenarioRequest): Promise<unknown>;
  askApproval(request: AskApprovalRequest): { answer: string[] };
}
