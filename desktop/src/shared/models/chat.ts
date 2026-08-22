import type { ScenarioNodeRun, ScenarioRun } from "./automation";
import type { RunStatus as SharedRunStatus } from "./run";
import type { ChatUsage } from "../dto";

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
  text: string;
  reasoning: string;
  error: string | null;
  toolCalls: ChatToolCall[];
  lastUsage: ChatUsage;
  createdAt: string;
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
  | { type: "run.completed" | "run.cancelled"; runId: string }
  | { type: "run.failed"; runId: string; message: string };
