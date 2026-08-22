import type Database from "better-sqlite3";
import type {
  AgentTaskRun,
  TaskRunKind,
  TaskRunOrigin,
  TaskRunStatus,
} from "../../../shared/models/task";

interface TaskRunRow {
  id: string;
  run_id: string;
  kind: TaskRunKind;
  origin: TaskRunOrigin;
  title: string;
  agent_name: string | null;
  scenario_id: string | null;
  scenario_name: string | null;
  status: TaskRunStatus;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export class TaskHistoryRepository {
  constructor(private readonly db: Database.Database) {}

  listAgentRuns(): AgentTaskRun[] {
    const rows = this.db
      .prepare(
        `SELECT 'scenario:' || e.id id,
                e.id run_id,
                'scenario' kind,
                e.origin,
                s.name title,
                NULL agent_name,
                e.scenario_id,
                s.name scenario_name,
                e.status,
                e.error_message,
                e.created_at,
                e.started_at,
                e.completed_at
           FROM execution_runs e
           JOIN automation_scenarios s ON s.id = e.scenario_id
       ORDER BY e.created_at DESC, e.id DESC`,
      )
      .all() as TaskRunRow[];
    return rows.map(mapTaskRun);
  }
}

function mapTaskRun(row: TaskRunRow): AgentTaskRun {
  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind,
    origin: row.origin,
    title: row.title,
    agentName: row.agent_name,
    scenarioId: row.scenario_id,
    scenarioName: row.scenario_name,
    status: row.status,
    error: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
