import type Database from "better-sqlite3";
import type {
  AgentSecretBinding,
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
  model: string;
  text_model_id: string | null;
  status: AutomationAgent["status"];
  require_dangerous_action_confirmation: number;
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
  graph_json: string;
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

  listAgents(): AutomationAgent[] {
    const rows = this.database
      .prepare(
        `SELECT id, name, description, instructions, model, text_model_id, status,
                require_dangerous_action_confirmation, max_tool_calls,
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
        `SELECT id, name, description, instructions, model, text_model_id, status,
                require_dangerous_action_confirmation, max_tool_calls,
                timeout_seconds, runs, updated_at
         FROM automation_agents WHERE id = ?`,
      )
      .get(id) as AgentRow | undefined;
    return row ? this.mapAgent(row) : undefined;
  }

  secretExists(id: number): boolean {
    return Boolean(
      this.database.prepare("SELECT 1 FROM secret_entities WHERE id = ?").get(id),
    );
  }

  textModelExists(id: string): boolean {
    const separator = id.indexOf(":");
    if (separator < 1) return false;
    return Boolean(this.database.prepare("SELECT 1 FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id WHERE m.provider_id=? AND m.remote_id=? AND m.enabled=1 AND p.enabled=1").get(id.slice(0, separator), id.slice(separator + 1)));
  }

  upsertAgent(
    id: string,
    input: UpsertAutomationAgentInput,
  ): AutomationAgent {
    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO automation_agents (
             id, name, description, instructions, model, text_model_id, status,
             require_dangerous_action_confirmation, max_tool_calls,
             timeout_seconds
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             instructions = excluded.instructions,
             model = excluded.model,
             text_model_id = excluded.text_model_id,
             status = excluded.status,
             require_dangerous_action_confirmation = excluded.require_dangerous_action_confirmation,
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
          input.textModelId,
          input.status,
          Number(input.requireDangerousActionConfirmation),
          input.maxToolCalls,
          input.timeoutSeconds,
        );

      this.database
        .prepare("DELETE FROM automation_agent_tools WHERE agent_id = ?")
        .run(id);
      this.database
        .prepare("DELETE FROM automation_agent_secrets WHERE agent_id = ?")
        .run(id);

      const insertTool = this.database.prepare(
        "INSERT INTO automation_agent_tools (agent_id, tool_id) VALUES (?, ?)",
      );
      for (const toolId of input.allowedToolIds) insertTool.run(id, toolId);

      const insertSecret = this.database.prepare(
        "INSERT INTO automation_agent_secrets (agent_id, secret_id) VALUES (?, ?)",
      );
      const insertSecretTool = this.database.prepare(
        `INSERT INTO automation_agent_secret_tools
           (agent_id, secret_id, tool_id) VALUES (?, ?, ?)`,
      );
      for (const binding of input.secretBindings) {
        insertSecret.run(id, binding.secretId);
        for (const toolId of binding.allowedToolIds)
          insertSecretTool.run(id, binding.secretId, toolId);
      }
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
        `SELECT id, name, description, status, graph_json,
                last_run_at, updated_at
         FROM automation_scenarios
         ORDER BY updated_at DESC, name ASC`,
      )
      .all() as ScenarioRow[];
    return rows.map((row) => this.mapScenario(row));
  }

  findScenario(id: string): AutomationScenario | undefined {
    const row = this.database
      .prepare(
        `SELECT id, name, description, status, graph_json,
                last_run_at, updated_at
         FROM automation_scenarios WHERE id = ?`,
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
             (id, name, description, status, graph_json)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             status = excluded.status,
             graph_json = excluded.graph_json,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .run(
          id,
          input.name,
          input.description,
          input.status,
          JSON.stringify(input.graph),
        );

      this.database
        .prepare(
          "DELETE FROM automation_scenario_tool_settings WHERE scenario_id = ?",
        )
        .run(id);
      const insertSetting = this.database.prepare(
        `INSERT INTO automation_scenario_tool_settings
           (scenario_id, tool_id, settings_json) VALUES (?, ?, ?)`,
      );
      for (const setting of input.toolSettings)
        insertSetting.run(id, setting.toolId, JSON.stringify(setting.settings));
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

    const secrets = this.database
      .prepare(
        "SELECT secret_id FROM automation_agent_secrets WHERE agent_id = ? ORDER BY secret_id",
      )
      .all(row.id) as Array<{ secret_id: number }>;
    const selectSecretTools = this.database.prepare(
      `SELECT tool_id FROM automation_agent_secret_tools
       WHERE agent_id = ? AND secret_id = ? ORDER BY tool_id`,
    );
    const secretBindings: AgentSecretBinding[] = secrets.map(({ secret_id }) => ({
      secretId: secret_id,
      allowedToolIds: (
        selectSecretTools.all(row.id, secret_id) as Array<{ tool_id: string }>
      ).map(({ tool_id }) => tool_id),
    }));

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      textModelId: row.text_model_id,
      status: row.status,
      allowedToolIds,
      secretBindings,
      requireDangerousActionConfirmation: Boolean(
        row.require_dangerous_action_confirmation,
      ),
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
    const toolSettings = (
      this.database
        .prepare(
          `SELECT tool_id, settings_json
           FROM automation_scenario_tool_settings
           WHERE scenario_id = ? ORDER BY tool_id`,
        )
        .all(row.id) as Array<{ tool_id: string; settings_json: string }>
    ).map<AutomationScenarioToolSetting>(({ tool_id, settings_json }) => ({
      toolId: tool_id,
      settings: parseJson<Record<string, unknown>>(settings_json, {}),
    }));

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      graph,
      toolSettings,
      nodesCount: graph.nodes.length,
      lastRunAt: row.last_run_at,
      updatedAt: row.updated_at,
    };
  }
}
