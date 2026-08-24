import type { ScenarioNodeRun, ScenarioRun } from "./automation";
import type { RunStatus as SharedRunStatus } from "./run";
import type {
  ChatMessageContentPart,
  ChatUsage,
  ContextWindow,
  ModelSwitch,
  RunUsage,
} from "../dto";

export type RunStatus = SharedRunStatus;
export interface ChatConversation {
  id: string;
  title: string;
  lastUsage: ChatUsage;
  updatedAt: string;
}
export interface ChatToolCall {
  id: string;
  toolId: string;
  status: "requested" | "running" | "completed" | "failed";
  input: unknown;
  output: unknown | null;
  error: string | null;
}
export interface ChatMessage {
  id: string;
  conversationId: string;
  runId: string | null;
  scenarioRunId: string | null;
  role: "system" | "user" | "assistant" | "tool";
  status: "streaming" | "completed" | "failed" | "cancelled";
  parts: ChatMessageContentPart[];
  text: string;
  reasoning: string;
  error: string | null;
  toolCalls: ChatToolCall[];
  lastUsage: ChatUsage;
  compactedInto: string | null;
  tokenCount: number;
  createdAt: string;
}
export interface ChatSnapshot {
  conversations: ChatConversation[];
  messages: ChatMessage[];
  hasMoreMessages: boolean;
  segments: ContextSegment[];
}
export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}
export interface ContextSegment {
  id: string;
  conversationId: string;
  fromMessageId: string;
  toMessageId: string;
  summary: string;
  modelId: string | null;
  messageCount: number;
  tokensBefore: number;
  tokensAfter: number;
  reason: "threshold" | "overflow" | "manual" | "model_switch";
  createdAt: string;
}
export type RunEvent =
  | {
      type: "run.started";
      runId: string;
      conversationId: string;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
    }
  | {
      type: "text.delta" | "reasoning.delta";
      runId: string;
      messageId: string;
      delta: string;
    }
  | { type: "scenario.run"; run: ScenarioRun }
  | { type: "scenario.node"; runId: string; node: ScenarioNodeRun }
  | {
      type: "scenario.node.delta";
      runId: string;
      nodeId: string;
      delta: string;
    }
  | {
      type: "scenario.approval.required";
      runId: string;
      nodeId: string;
      prompt: string;
    }
  | {
      type: "tool.requested" | "tool.running" | "tool.completed";
      runId: string;
      toolCallId: string;
      toolId: string;
      input?: unknown;
      output?: unknown;
      error?: string;
    }
  | { type: "run.usage"; runId: string; conversationId: string; usage: RunUsage }
  | {
      type: "run.model.switched";
      runId: string;
      conversationId: string;
      change: ModelSwitch;
    }
  | { type: "context.window"; window: ContextWindow }
  | {
      type: "context.compacted";
      runId: string | null;
      conversationId: string;
      segment: ContextSegment;
    }
  | { type: "file.changed"; runId: string; edit: FileEditRecord }
  | { type: "run.completed" | "run.cancelled"; runId: string }
  | { type: "run.failed"; runId: string; message: string };

export interface FileEditRecord {
  id: string;
  runId: string | null;
  conversationId: string | null;
  path: string;
  operation: "create" | "modify" | "delete" | "move";
  movedTo: string | null;
  diff: string;
  bytesBefore: number;
  bytesAfter: number;
  reverted: boolean;
  createdAt: string;
}
