import type { ScenarioNodeRun, ScenarioRun } from "./automation";
import type { RunStatus as SharedRunStatus } from "./run";
import type { ChatMode, ChatUsage } from "../dto";

export type RunStatus = SharedRunStatus;
export interface ChatConversation {
  id: number;
  title: string;
  lastUsage: ChatUsage;
  updatedAt: string;
}
export interface ChatToolCall {
  id: number;
  toolId: string;
  status: "requested" | "running" | "completed" | "failed";
  input: unknown;
  output: unknown | null;
  error: string | null;
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
      runId: number;
      conversationId: number;
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
    }
  | {
      type: "text.delta" | "reasoning.delta";
      runId: number;
      messageId: number;
      delta: string;
    }
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
