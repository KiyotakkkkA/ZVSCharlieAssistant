import type { RunOrigin, RunStatus } from "./run";
export type TaskRunKind = "chat" | "planner" | "agent" | "scenario";
export type TaskRunOrigin = RunOrigin;
export type TaskRunStatus = RunStatus;
export interface AgentTaskRun {
  id: string;
  runId: string;
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
