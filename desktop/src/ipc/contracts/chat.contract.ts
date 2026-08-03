import type { ScenarioNodeRun, ScenarioRun } from "./automation.contract";

export type ChatMode = "chat" | "planner" | "agent" | "scenario";
export type RunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled";
export interface ChatConversation {
  id: number;
  title: string;
  mode: ChatMode;
  agentId: string | null;
  modelId: number | null;
  updatedAt: string;
}
export interface ChatMessage {
  id: number;
  conversationId: number;
  runId: number | null;
  scenarioRunId: number | null;
  role: "system" | "user" | "assistant" | "tool";
  status: "streaming" | "completed" | "failed" | "cancelled";
  text: string;
  reasoning: string;
  toolCalls: ChatToolCall[];
  createdAt: string;
}
export interface ChatToolCall {
  id: number;
  toolId: string;
  status: "requested" | "running" | "completed" | "failed";
  input: unknown;
  output: unknown | null;
  error: string | null;
}
export interface ChatSnapshot {
  conversations: ChatConversation[];
  messages: ChatMessage[];
  hasMoreMessages: boolean;
}
export interface ChatMessagePage {
  messages: ChatMessage[];
  hasMore: boolean;
}
export interface StartRunInput {
  conversationId?: number;
  mode: ChatMode;
  modelId?: number;
  agentId?: string;
  scenarioId?: string;
  text: string;
}
export type RunEvent =
  | {
      type: "run.started";
      runId: number;
      conversationId: number;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
    }
  | { type: "text.delta"; runId: number; messageId: number; delta: string }
  | { type: "reasoning.delta"; runId: number; messageId: number; delta: string }
  | { type: "scenario.run"; run: ScenarioRun }
  | { type: "scenario.node"; runId: number; node: ScenarioNodeRun }
  | {
      type: "scenario.node.delta";
      runId: number;
      nodeId: string;
      delta: string;
    }
  | {
      type: "scenario.approval.required";
      runId: number;
      nodeId: string;
      prompt: string;
    }
  | {
      type: "tool.requested" | "tool.running" | "tool.completed";
      runId: number;
      toolCallId: number;
      toolId: string;
      input?: unknown;
      output?: unknown;
      error?: string;
    }
  | { type: "run.completed" | "run.cancelled"; runId: number }
  | { type: "run.failed"; runId: number; message: string };
export interface ChatApi {
  getSnapshot(conversationId?: number): Promise<ChatSnapshot>;
  getMessagesPage(
    conversationId: number,
    beforeId?: number,
  ): Promise<ChatMessagePage>;
  startRun(
    input: StartRunInput,
  ): Promise<{ runId: number; conversationId: number }>;
  cancelRun(runId: number): Promise<void>;
  deleteConversation(id: number): Promise<void>;
  renameConversation(id: number, title: string): Promise<void>;
  truncateMessages(conversationId: number, fromMessageId: number): Promise<void>;
  subscribe(listener: (event: RunEvent) => void): () => void;
}
export const CHAT_IPC_CHANNELS = {
  getSnapshot: "chat:get-snapshot",
  getMessagesPage: "chat:get-messages-page",
  startRun: "chat:start-run",
  cancelRun: "chat:cancel-run",
  deleteConversation: "chat:delete-conversation",
  renameConversation: "chat:rename-conversation",
  truncateMessages: "chat:truncate-messages",
  event: "chat:event",
} as const;
