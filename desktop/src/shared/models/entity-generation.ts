import type { GeneratedEntityKind } from "../dto/entity-generation.dto";
import type { QuestionMode, QuestionOption } from "./user-question";
import type { ChatMessageContentPart } from "../dto/chat.dto";

export type { GeneratedEntityKind };
export type EntityGenerationStatus =
  | "queued"
  | "running"
  | "clarification_requested"
  | "completed"
  | "failed"
  | "cancelled";

export interface PendingGenerationQuestion {
  id: string;
  header: string;
  question: string;
  options: QuestionOption[];
  multiSelect: boolean;
  mode: QuestionMode;
}

export interface GenerationTranscriptMessage {
  role: "user" | "assistant" | "tool";
  parts: ChatMessageContentPart[];
  createdAt: string;
}

export interface EntityGenerationRun {
  id: string;
  kind: GeneratedEntityKind;
  modelId: string;
  prompt: string;
  status: EntityGenerationStatus;
  entityId: string | null;
  entityName: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pendingQuestion: PendingGenerationQuestion | null;
}

export type GenerationRunEvent =
  | { type: "run.updated"; run: EntityGenerationRun }
  | { type: "text.delta"; runId: string; delta: string }
  | { type: "reasoning.delta"; runId: string; delta: string }
  | {
      type: "tool.call";
      runId: string;
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      type: "tool.result";
      runId: string;
      toolCallId: string;
      toolName: string;
      output: unknown;
      isError?: boolean;
    }
  | { type: "step.completed"; runId: string };
