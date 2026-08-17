import type { ToolSet } from "ai";
import type { z } from "zod";
import type {
  AgentDirectoryPolicy,
  AgentTerminalPolicy,
} from "../../../../shared/dto";
import type { ScenarioFileReference } from "../../../../shared/dto/scenario-trigger-event.dto";

export interface GenerateTextRequest {
  runId: number;
  nodeId: string;
  modelId: number;
  system: string;
  prompt: unknown;
  signal: AbortSignal;
  maxOutputTokens: number;
  temperature?: number | null;
  topP?: number | null;
  tools?: ToolSet;
  maxToolCalls?: number;
  onDelta?(delta: string): void;
}

export interface GenerateObjectRequest<T> {
  runId: number;
  nodeId: string;
  modelId: number;
  system: string;
  prompt: unknown;
  signal: AbortSignal;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}

export interface KnowledgeChunk {
  documentId: number;
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
  textModelId: number | null;
  allowedToolIds: string[];
  allowedVectorStoreIds: number[];
  allowedSkillIds: number[];
  retrievalLimit: number;
  maxToolCalls: number;
  timeoutSeconds: number;
  terminalPolicy: AgentTerminalPolicy;
  directoryPolicy: AgentDirectoryPolicy;
}

export interface CreateToolsRequest {
  signal: AbortSignal;
  allowedToolIds: string[];
  allowedVectorStoreIds: number[];
  retrievalLimit: number;
  allowedSkillIds: number[];
  terminalPolicy?: AgentTerminalPolicy;
  directoryPolicy?: AgentDirectoryPolicy;
  onToolResult?(toolId: string, input: unknown, output: unknown): void;
}

export interface DownloadFilesRequest {
  executionId: number;
  nodeRunId: number;
  nodeId: string;
  value: unknown;
  maxFileSizeBytes: number;
  maxFiles: number;
  signal: AbortSignal;
}

export interface DownloadedFile {
  id: number;
  fileName: string;
  mimeType: string | null;
  size: number;
  sha256: string;
  storageKey: string;
}

export interface ReadFilesResult {
  documents: Array<{
    fileId: number;
    fileName: string;
    mimeType: string | null;
    text: string;
    truncated: boolean;
  }>;
  unsupportedFiles: Array<{ fileId: number; fileName: string }>;
}

export interface DeliverResponseRequest {
  executionId: number;
  nodeRunId: number;
  config: unknown;
  triggerInput: unknown;
  output: unknown;
}

export interface RunSubScenarioRequest {
  scenarioId: string;
  input: unknown;
  signal: AbortSignal;
  mode: "await" | "fireAndForget";
}

export interface AskApprovalRequest {
  executionId: number;
  nodeId: string;
  nodeRunId: number;
  triggerInput: unknown;
  mode: "confirm" | "choice" | "text";
  header: string;
  question: string;
  options: Array<{ label: string; description?: string }>;
  multiSelect: boolean;
  defaultAnswer: string | null;
  timeoutSeconds: number | null;
  channel: "ui" | "trigger" | "telegram" | "email";
  integrationProfileId: number | null;
  recipient: string;
}

export interface ScenarioEngineServices {
  defaultModelId(): number | null;
  agent(agentId: string): ScenarioAgentRecord | undefined;

  generateText(request: GenerateTextRequest): Promise<string>;
  generateObject<T>(request: GenerateObjectRequest<T>): Promise<T>;

  createTools(request: CreateToolsRequest): ToolSet | undefined;

  searchKnowledge(input: {
    vectorStoreIds: number[];
    query: string;
    limit: number;
    minScore?: number;
  }): Promise<KnowledgeChunk[]>;

  httpFetch: typeof fetch;
  secret(secretId: number): string | undefined;

  downloadFiles(request: DownloadFilesRequest): Promise<DownloadedFile[]>;
  readFiles(input: {
    files: ScenarioFileReference[];
    maxCharactersPerFile: number;
  }): Promise<ReadFilesResult>;

  deliverResponse(request: DeliverResponseRequest): void;
  runSubScenario(request: RunSubScenarioRequest): Promise<unknown>;
  askApproval(request: AskApprovalRequest): { answer: string[] };
}
