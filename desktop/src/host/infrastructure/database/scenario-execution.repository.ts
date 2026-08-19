import type Database from "better-sqlite3";
import type {
  AutomationScenarioNodeKind,
  ScenarioNodeRun,
  ScenarioRun,
  ScenarioRunOrigin,
  ScenarioRunStatus,
} from "../../../shared/models/automation";
const parse = (value: string | null): unknown =>
  value ? JSON.parse(value) : null;

export class ScenarioExecutionRepository {
  constructor(private readonly db: Database.Database) {}

  recoverInterruptedRuns(): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE scenario_node_runs SET status='failed',error_message='Выполнение было прервано перезапуском приложения',completed_at=CURRENT_TIMESTAMP
         WHERE status IN ('queued','running','waiting_for_approval')`,
        )
        .run();
      this.db
        .prepare(
          `UPDATE execution_runs SET
           status=CASE WHEN origin='background' THEN 'queued' ELSE 'failed' END,
           error_message=CASE WHEN origin='background' THEN NULL ELSE 'Выполнение было прервано перезапуском приложения' END,
           completed_at=CASE WHEN origin='background' THEN NULL ELSE CURRENT_TIMESTAMP END
         WHERE status IN ('queued','running','waiting_for_approval')`,
        )
        .run();
      this.db
        .prepare(
          `UPDATE execution_approvals SET status='expired',resolved_at=CURRENT_TIMESTAMP WHERE status='pending'`,
        )
        .run();
    })();
  }

  createRun(
    scenarioId: string,
    revisionId: number,
    origin: ScenarioRunOrigin,
    input: unknown,
    conversationId?: number,
  ): ScenarioRun {
    const id = Number(
      this.db
        .prepare(
          `INSERT INTO execution_runs(kind,origin,scenario_id,scenario_revision_id,conversation_id,status,input_json)
       VALUES('scenario',?,?,?,?,'queued',?)`,
        )
        .run(
          origin,
          scenarioId,
          revisionId,
          conversationId ?? null,
          JSON.stringify(input ?? null),
        ).lastInsertRowid,
    );
    return this.run(id)!;
  }

  run(id: number): ScenarioRun | undefined {
    const row = this.db
      .prepare(
        `SELECT e.*,s.name scenario_name FROM execution_runs e
       JOIN automation_scenarios s ON s.id=e.scenario_id WHERE e.id=?`,
      )
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapRun(row) : undefined;
  }

  latestRun(scenarioId: string): ScenarioRun | undefined {
    const row = this.db
      .prepare(
        `SELECT e.*,s.name scenario_name FROM execution_runs e
       JOIN automation_scenarios s ON s.id=e.scenario_id
       WHERE e.scenario_id=? AND e.kind='scenario'
       ORDER BY e.id DESC LIMIT 1`,
      )
      .get(scenarioId) as Record<string, unknown> | undefined;
    return row ? mapRun(row) : undefined;
  }

  nodeRuns(id: number): ScenarioNodeRun[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM scenario_node_runs WHERE execution_id=? ORDER BY id",
        )
        .all(id) as Array<Record<string, unknown>>
    ).map(mapNodeRun);
  }

  completedOutputs(id: number): Map<string, unknown> {
    const rows = this.db
      .prepare(
        `SELECT node_id,output_json FROM scenario_node_runs
       WHERE execution_id=? AND status='completed' ORDER BY id`,
      )
      .all(id) as Array<{ node_id: string; output_json: string | null }>;
    return new Map(rows.map((row) => [row.node_id, parse(row.output_json)]));
  }

  setRunStatus(
    id: number,
    status: ScenarioRunStatus,
    output?: unknown,
    error?: string,
  ) {
    this.db
      .prepare(
        `UPDATE execution_runs SET status=?, output_json=?, error_message=?,
       started_at=CASE WHEN ?='running' AND started_at IS NULL THEN CURRENT_TIMESTAMP ELSE started_at END,
       completed_at=CASE WHEN ? IN ('completed','failed','cancelled') THEN CURRENT_TIMESTAMP ELSE completed_at END
       WHERE id=?`,
      )
      .run(
        status,
        output === undefined ? null : JSON.stringify(output),
        error ?? null,
        status,
        status,
        id,
      );
    if (status === "completed")
      this.db
        .prepare(
          "UPDATE automation_scenarios SET last_run_at=CURRENT_TIMESTAMP WHERE id=(SELECT scenario_id FROM execution_runs WHERE id=?)",
        )
        .run(id);
  }

  startNode(
    executionId: number,
    nodeId: string,
    kind: AutomationScenarioNodeKind,
    input: unknown,
  ): ScenarioNodeRun {
    const attempt = Number(
      (
        this.db
          .prepare(
            "SELECT COALESCE(MAX(attempt),0)+1 value FROM scenario_node_runs WHERE execution_id=? AND node_id=?",
          )
          .get(executionId, nodeId) as { value: number }
      ).value,
    );
    const id = Number(
      this.db
        .prepare(
          `INSERT INTO scenario_node_runs(execution_id,node_id,node_kind,attempt,status,input_json,started_at)
       VALUES(?,?,?,?,'running',?,CURRENT_TIMESTAMP)`,
        )
        .run(executionId, nodeId, kind, attempt, JSON.stringify(input ?? null))
        .lastInsertRowid,
    );
    return this.nodeRun(id)!;
  }

  finishNode(
    id: number,
    status: ScenarioRunStatus,
    output?: unknown,
    error?: string,
  ): ScenarioNodeRun {
    this.db
      .prepare(
        `UPDATE scenario_node_runs SET status=?,output_json=?,error_message=?,completed_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(
        status,
        output === undefined ? null : JSON.stringify(output),
        error ?? null,
        id,
      );
    return this.nodeRun(id)!;
  }

  setNodeStatus(id: number, status: ScenarioRunStatus) {
    this.db
      .prepare("UPDATE scenario_node_runs SET status=? WHERE id=?")
      .run(status, id);
  }

  requestApproval(
    executionId: number,
    nodeRunId: number,
    prompt: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO execution_approvals(execution_id,node_run_id,prompt) VALUES(?,?,?)`,
      )
      .run(executionId, nodeRunId, prompt);
  }

  resolveApproval(executionId: number, approved: boolean): void {
    this.db
      .prepare(
        `UPDATE execution_approvals SET status=?,resolved_at=CURRENT_TIMESTAMP
       WHERE execution_id=? AND status='pending'`,
      )
      .run(approved ? "approved" : "denied", executionId);
  }

  agent(id: string) {
    const agent = this.db
      .prepare(
        `SELECT id,name,description,instructions,text_model_id,retrieval_limit,
               max_tool_calls,timeout_seconds,terminal_policy_json,directory_policy_json
       FROM automation_agents WHERE id=? AND status!='disabled'`,
      )
      .get(id) as
      | {
          id: string;
          name: string;
          description: string;
          instructions: string;
          text_model_id: number;
          retrieval_limit: number;
          max_tool_calls: number;
          timeout_seconds: number;
          terminal_policy_json: string;
          directory_policy_json: string;
        }
      | undefined;
    if (!agent) return undefined;
    const allowedToolIds = (
      this.db
        .prepare("SELECT tool_id FROM automation_agent_tools WHERE agent_id=?")
        .all(id) as Array<{ tool_id: string }>
    ).map((item) => item.tool_id);
    const allowedVectorStoreIds = (
      this.db
        .prepare(
          "SELECT vector_store_id FROM automation_agent_vector_stores WHERE agent_id=?",
        )
        .all(id) as Array<{ vector_store_id: number }>
    ).map((item) => item.vector_store_id);
    const allowedSkillIds = (
      this.db
        .prepare(
          "SELECT skill_id FROM automation_agent_skills WHERE agent_id=? ORDER BY skill_id",
        )
        .all(id) as Array<{ skill_id: number }>
    ).map((item) => item.skill_id);
    return {
      ...agent,
      terminalPolicy: JSON.parse(agent.terminal_policy_json),
      directoryPolicy: JSON.parse(agent.directory_policy_json),
      allowedToolIds,
      allowedVectorStoreIds,
      allowedSkillIds,
    };
  }

  defaultModelId(): number | undefined {
    return (
      this.db
        .prepare(
          `SELECT m.id FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id
       WHERE m.enabled=1 AND p.enabled=1 AND p.provider_type='text' ORDER BY m.id LIMIT 1`,
        )
        .get() as { id: number } | undefined
    )?.id;
  }

  nodeRun(id: number): ScenarioNodeRun | undefined {
    const row = this.db
      .prepare("SELECT * FROM scenario_node_runs WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapNodeRun(row) : undefined;
  }
}

const mapRun = (r: Record<string, unknown>): ScenarioRun => ({
  id: Number(r.id),
  scenarioId: String(r.scenario_id),
  scenarioRevisionId: Number(r.scenario_revision_id),
  scenarioName: String(r.scenario_name),
  origin: r.origin as ScenarioRunOrigin,
  status: r.status as ScenarioRunStatus,
  input: parse(String(r.input_json)),
  output: parse(r.output_json as string | null),
  error: r.error_message as string | null,
  createdAt: String(r.created_at),
  startedAt: r.started_at as string | null,
  completedAt: r.completed_at as string | null,
});

const mapNodeRun = (r: Record<string, unknown>): ScenarioNodeRun => ({
  id: Number(r.id),
  executionId: Number(r.execution_id),
  nodeId: String(r.node_id),
  nodeKind: r.node_kind as AutomationScenarioNodeKind,
  attempt: Number(r.attempt),
  status: r.status as ScenarioRunStatus,
  input: parse(String(r.input_json)),
  output: parse(r.output_json as string | null),
  error: r.error_message as string | null,
  startedAt: r.started_at as string | null,
  completedAt: r.completed_at as string | null,
});
