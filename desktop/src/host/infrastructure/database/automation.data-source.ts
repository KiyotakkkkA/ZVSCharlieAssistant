import type Database from "better-sqlite3";
import type {
  AutomationAgent,
  AutomationScenario,
  AutomationScenarioGraph,
  AutomationScenarioToolSetting,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
} from "../../../ipc/contracts";

interface AgentRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  text_model_id: number | null;
  status: AutomationAgent["status"];
  max_tool_calls: number;
  timeout_seconds: number;
  runs: number;
  updated_at: string;
}

interface ScenarioRow {
  id: string;
  name: string;
  description: string;
  status: AutomationScenario["status"];
  revision_id: number;
  version: number;
  graph_json: string;
  tool_settings_json: string;
  last_run_at: string | null;
  updated_at: string;
}

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export class AutomationDataSource {
  constructor(private readonly database: Database.Database) {}

  listToolSecretBindings(toolId: string) {
    return this.database
      .prepare(
        `SELECT binding_key, secret_id
         FROM automation_tool_secret_bindings WHERE tool_id=? ORDER BY binding_key`,
      )
      .all(toolId) as Array<{ binding_key: string; secret_id: number }>;
  }

  toolSecretId(toolId: string, key: string): number | undefined {
    return (
      this.database
        .prepare(
          "SELECT secret_id FROM automation_tool_secret_bindings WHERE tool_id=? AND binding_key=?",
        )
        .get(toolId, key) as { secret_id: number } | undefined
    )?.secret_id;
  }

  upsertToolSecretBinding(
    toolId: string,
    key: string,
    secretId: number | null,
  ) {
    if (secretId === null) {
      this.database
        .prepare(
          "DELETE FROM automation_tool_secret_bindings WHERE tool_id=? AND binding_key=?",
        )
        .run(toolId, key);
      return;
    }
    this.database
      .prepare(
        `INSERT INTO automation_tool_secret_bindings(tool_id,binding_key,secret_id)
         VALUES(?,?,?) ON CONFLICT(tool_id,binding_key)
         DO UPDATE SET secret_id=excluded.secret_id`,
      )
      .run(toolId, key, secretId);
  }

  secretExistsInCategory(id: number, categoryId: number): boolean {
    return Boolean(
      this.database
        .prepare("SELECT 1 FROM secret_entities WHERE id=? AND category_id=?")
        .get(id, categoryId),
    );
  }

  listAgents(): AutomationAgent[] {
    const rows = this.database
      .prepare(
        `SELECT id, name, description, instructions, text_model_id, status,
                max_tool_calls,
                timeout_seconds, runs, updated_at
         FROM automation_agents
         ORDER BY updated_at DESC, name ASC`,
      )
      .all() as AgentRow[];
    return rows.map((row) => this.mapAgent(row));
  }

  findAgent(id: string): AutomationAgent | undefined {
    const row = this.database
      .prepare(
        `SELECT id, name, description, instructions, text_model_id, status,
                max_tool_calls,
                timeout_seconds, runs, updated_at
         FROM automation_agents WHERE id = ?`,
      )
      .get(id) as AgentRow | undefined;
    return row ? this.mapAgent(row) : undefined;
  }

  textModelExists(id: number): boolean {
    return Boolean(
      this.database
        .prepare(
          "SELECT 1 FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id WHERE m.id=? AND m.enabled=1 AND p.enabled=1 AND p.provider_type='text'",
        )
        .get(id),
    );
  }

  upsertAgent(id: string, input: UpsertAutomationAgentInput): AutomationAgent {
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO automation_agents (
             id, name, description, instructions, text_model_id, status,
             max_tool_calls,
             timeout_seconds
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             instructions = excluded.instructions,
             text_model_id = excluded.text_model_id,
             status = excluded.status,
             max_tool_calls = excluded.max_tool_calls,
             timeout_seconds = excluded.timeout_seconds,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .run(
          id,
          input.name,
          input.description,
          input.instructions,
          input.textModelId,
          input.status,
          input.maxToolCalls,
          input.timeoutSeconds,
        );

      this.database
        .prepare("DELETE FROM automation_agent_tools WHERE agent_id = ?")
        .run(id);
      const insertTool = this.database.prepare(
        "INSERT INTO automation_agent_tools (agent_id, tool_id) VALUES (?, ?)",
      );
      for (const toolId of input.allowedToolIds) insertTool.run(id, toolId);
    })();

    return this.findAgent(id)!;
  }

  deleteAgent(id: string): void {
    const result = this.database
      .prepare("DELETE FROM automation_agents WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new Error("Агент не найден");
  }

  listScenarios(): AutomationScenario[] {
    const rows = this.database
      .prepare(
        `SELECT s.id, s.name, s.description, s.status, r.id AS revision_id,
                r.version, r.graph_json, r.tool_settings_json,
                s.last_run_at, s.updated_at
         FROM automation_scenarios s
         JOIN automation_scenario_revisions r ON r.id = s.active_revision_id
         ORDER BY updated_at DESC, name ASC`,
      )
      .all() as ScenarioRow[];
    return rows.map((row) => this.mapScenario(row));
  }

  findScenario(id: string): AutomationScenario | undefined {
    const row = this.database
      .prepare(
        `SELECT s.id, s.name, s.description, s.status, r.id AS revision_id,
                r.version, r.graph_json, r.tool_settings_json,
                s.last_run_at, s.updated_at
         FROM automation_scenarios s
         JOIN automation_scenario_revisions r ON r.id = s.active_revision_id
         WHERE s.id = ?`,
      )
      .get(id) as ScenarioRow | undefined;
    return row ? this.mapScenario(row) : undefined;
  }

  upsertScenario(
    id: string,
    input: UpsertAutomationScenarioInput,
  ): AutomationScenario {
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO automation_scenarios
             (id, name, description, status)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             status = excluded.status,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .run(id, input.name, input.description, input.status);

      const version = (
        this.database
          .prepare(
            "SELECT COALESCE(MAX(version), 0) + 1 AS version FROM automation_scenario_revisions WHERE scenario_id = ?",
          )
          .get(id) as { version: number }
      ).version;
      const revisionId = Number(
        this.database
          .prepare(
            `INSERT INTO automation_scenario_revisions
               (scenario_id, version, graph_json, tool_settings_json)
             VALUES (?, ?, ?, ?)`,
          )
          .run(
            id,
            version,
            JSON.stringify(input.graph),
            JSON.stringify(input.toolSettings),
          ).lastInsertRowid,
      );
      this.database
        .prepare(
          "UPDATE automation_scenarios SET active_revision_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(revisionId, id);
    })();

    return this.findScenario(id)!;
  }

  deleteScenario(id: string): void {
    const result = this.database
      .prepare("DELETE FROM automation_scenarios WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new Error("Сценарий не найден");
  }

  private mapAgent(row: AgentRow): AutomationAgent {
    const allowedToolIds = (
      this.database
        .prepare(
          "SELECT tool_id FROM automation_agent_tools WHERE agent_id = ? ORDER BY tool_id",
        )
        .all(row.id) as Array<{ tool_id: string }>
    ).map(({ tool_id }) => tool_id);

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      textModelId: row.text_model_id,
      status: row.status,
      allowedToolIds,
      maxToolCalls: row.max_tool_calls,
      timeoutSeconds: row.timeout_seconds,
      runs: row.runs,
      updatedAt: row.updated_at,
    };
  }

  private mapScenario(row: ScenarioRow): AutomationScenario {
    const graph = parseJson<AutomationScenarioGraph>(row.graph_json, {
      nodes: [],
      edges: [],
    });
    const toolSettings = parseJson<AutomationScenarioToolSetting[]>(
      row.tool_settings_json,
      [],
    );

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      graph,
      toolSettings,
      revisionId: row.revision_id,
      version: row.version,
      nodesCount: graph.nodes.length,
      lastRunAt: row.last_run_at,
      updatedAt: row.updated_at,
    };
  }
}
