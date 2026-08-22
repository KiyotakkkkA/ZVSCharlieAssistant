export type QuestionMode = "confirm" | "choice" | "text";
export type QuestionScope = "chat" | "scenario";
export type QuestionChannel = "ui" | "telegram" | "email";
export type QuestionStatus = "pending" | "answered" | "timed_out" | "cancelled";

export interface QuestionOption {
  label: string;
  description?: string;
}

export interface UserQuestion {
  id: string;
  scope: QuestionScope;
  conversationId: string | null;
  runId: string | null;
  executionId: string | null;
  nodeId: string | null;
  nodeRunId: string | null;
  mode: QuestionMode;
  header: string;
  question: string;
  options: QuestionOption[];
  multiSelect: boolean;
  defaultAnswer: string | null;
  status: QuestionStatus;
  answer: string[] | null;
  answeredVia: "ui" | "telegram" | "email" | "default" | null;
  answeredBy: string | null;
  channel: QuestionChannel;
  recipient: string | null;
  correlationId: string | null;
  expectedAuthor: string | null;
  expiresAt: string | null;
  createdAt: string;
  answeredAt: string | null;
}
