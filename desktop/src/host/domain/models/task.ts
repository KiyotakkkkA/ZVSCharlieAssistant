export type TaskRunKind = "chat" | "planner" | "agent" | "scenario";
export type TaskRunOrigin = "manual" | "chat" | "background";
export type TaskRunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled";

export interface AgentTaskRun {
  id: string;
  runId: number;
  kind: TaskRunKind;
  origin: TaskRunOrigin;
  title: string;
  agentName: string | null;
  scenarioId: string | null;
  scenarioName: string | null;
  status: TaskRunStatus;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
