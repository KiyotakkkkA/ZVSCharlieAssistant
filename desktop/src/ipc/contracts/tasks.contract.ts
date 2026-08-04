import type { AgentTaskRun } from "../../shared/models/task";

export type * from "../../shared/models/task";

export interface TasksApi {
  listAgentRuns(): Promise<AgentTaskRun[]>;
}

export const TASKS_IPC_CHANNELS = {
  listAgentRuns: "tasks:list-agent-runs",
} as const;
