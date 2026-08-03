import type Database from "better-sqlite3";
import type {
  AutomationAgent,
  AutomationScenario,
  AutomationScenarioGraph,
  AutomationScenarioToolSetting,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  AutomationSkill,
  UpsertAutomationSkillInput,
} from "../../domain/models/automation";

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
  retrieval_limit: number;
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
                timeout_seconds, runs, updated_at, retrieval_limit
         FROM automation_agents
         ORDER BY updated_at DESC, name ASC`,
      )
      .all() as AgentRow[];
    const toolsByAgent = new Map<string, string[]>();
    for (const item of this.database
      .prepare(
        "SELECT agent_id,tool_id FROM automation_agent_tools ORDER BY tool_id",
      )
      .all() as Array<{ agent_id: string; tool_id: string }>) {
      const values = toolsByAgent.get(item.agent_id) ?? [];
      values.push(item.tool_id);
      toolsByAgent.set(item.agent_id, values);
    }
    const storesByAgent = new Map<string, number[]>();
    for (const item of this.database
      .prepare(
        "SELECT agent_id,vector_store_id FROM automation_agent_vector_stores ORDER BY vector_store_id",
      )
      .all() as Array<{ agent_id: string; vector_store_id: number }>) {
      const values = storesByAgent.get(item.agent_id) ?? [];
      values.push(item.vector_store_id);
      storesByAgent.set(item.agent_id, values);
    }
    const skillsByAgent = new Map<string, number[]>();
    for (const item of this.database
      .prepare("SELECT agent_id,skill_id FROM automation_agent_skills ORDER BY skill_id")
      .all() as Array<{ agent_id: string; skill_id: number }>) {
      const values = skillsByAgent.get(item.agent_id) ?? [];
      values.push(item.skill_id);
      skillsByAgent.set(item.agent_id, values);
    }
    return rows.map((row) =>
      this.mapAgent(
        row,
        toolsByAgent.get(row.id) ?? [],
        storesByAgent.get(row.id) ?? [],
        skillsByAgent.get(row.id) ?? [],
      ),
    );
  }

  findAgent(id: string): AutomationAgent | undefined {
    const row = this.database
      .prepare(
        `SELECT id, name, description, instructions, text_model_id, status,
                max_tool_calls,
                timeout_seconds, runs, updated_at, retrieval_limit
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

  vectorStoreExists(id: number): boolean {
    return Boolean(
      this.database
        .prepare(
          "SELECT 1 FROM vector_stores WHERE id=? AND embedding_model_id IS NOT NULL AND status!='disabled'",
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
             timeout_seconds, retrieval_limit
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             instructions = excluded.instructions,
             text_model_id = excluded.text_model_id,
             status = excluded.status,
             max_tool_calls = excluded.max_tool_calls,
             timeout_seconds = excluded.timeout_seconds,
             retrieval_limit = excluded.retrieval_limit,
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
          input.retrievalLimit,
        );

      this.database
        .prepare("DELETE FROM automation_agent_tools WHERE agent_id = ?")
        .run(id);
      const insertTool = this.database.prepare(
        "INSERT INTO automation_agent_tools (agent_id, tool_id) VALUES (?, ?)",
      );
      for (const toolId of input.allowedToolIds) insertTool.run(id, toolId);
      this.database
        .prepare("DELETE FROM automation_agent_vector_stores WHERE agent_id=?")
        .run(id);
      const insertStore = this.database.prepare(
        "INSERT INTO automation_agent_vector_stores(agent_id,vector_store_id) VALUES(?,?)",
      );
      for (const storeId of input.allowedVectorStoreIds)
        insertStore.run(id, storeId);
      this.database
        .prepare("DELETE FROM automation_agent_skills WHERE agent_id=?")
        .run(id);
      const insertSkill = this.database.prepare(
        "INSERT INTO automation_agent_skills(agent_id,skill_id) VALUES(?,?)",
      );
      for (const skillId of input.allowedSkillIds) insertSkill.run(id, skillId);
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

  private mapAgent(
    row: AgentRow,
    toolIds?: string[],
    vectorStoreIds?: number[],
    skillIds?: number[],
  ): AutomationAgent {
    const allowedToolIds =
      toolIds ??
      (
        this.database
          .prepare(
            "SELECT tool_id FROM automation_agent_tools WHERE agent_id = ? ORDER BY tool_id",
          )
          .all(row.id) as Array<{ tool_id: string }>
      ).map(({ tool_id }) => tool_id);
    const allowedVectorStoreIds =
      vectorStoreIds ??
      (
        this.database
          .prepare(
            "SELECT vector_store_id FROM automation_agent_vector_stores WHERE agent_id=? ORDER BY vector_store_id",
          )
          .all(row.id) as Array<{ vector_store_id: number }>
      ).map((item) => item.vector_store_id);
    const allowedSkillIds =
      skillIds ??
      (this.database
        .prepare("SELECT skill_id FROM automation_agent_skills WHERE agent_id=? ORDER BY skill_id")
        .all(row.id) as Array<{ skill_id: number }>).map((item) => item.skill_id);

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      textModelId: row.text_model_id,
      status: row.status,
      allowedToolIds,
      allowedVectorStoreIds,
      allowedSkillIds,
      retrievalLimit: row.retrieval_limit,
      maxToolCalls: row.max_tool_calls,
      timeoutSeconds: row.timeout_seconds,
      runs: row.runs,
      updatedAt: row.updated_at,
    };
  }

  listSkills(): Omit<AutomationSkill, "instructions">[] {
    return (this.database.prepare(`
      SELECT s.id,s.slug,s.name,s.description,s.status,s.version,s.author,s.builtin,
             s.required_tool_ids_json,s.updated_at,COUNT(a.agent_id) assigned_agents_count
      FROM automation_skills s
      LEFT JOIN automation_agent_skills a ON a.skill_id=s.id
      GROUP BY s.id ORDER BY s.updated_at DESC,s.name ASC
    `).all() as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id), slug: String(row.slug), name: String(row.name),
      description: String(row.description), status: row.status as AutomationSkill["status"],
      version: String(row.version), author: String(row.author),
      requiredToolIds: parseJson(String(row.required_tool_ids_json), []),
      assignedAgentsCount: Number(row.assigned_agents_count), updatedAt: String(row.updated_at),
      builtin: Boolean(row.builtin),
    }));
  }

  ensureBuiltinSkill(input: Omit<UpsertAutomationSkillInput, "id" | "instructions">): number {
    const existing = this.database.prepare("SELECT id FROM automation_skills WHERE slug=?").get(input.slug) as { id: number } | undefined;
    if (existing) {
      this.database.prepare(`UPDATE automation_skills SET name=?,description=?,status='active',version=?,author=?,builtin=1,required_tool_ids_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(input.name,input.description,input.version,input.author,JSON.stringify(input.requiredToolIds),existing.id);
      return existing.id;
    }
    return Number(this.database.prepare(`INSERT INTO automation_skills(slug,name,description,status,version,author,builtin,required_tool_ids_json) VALUES(?,?,?,'active',?,?,1,?)`).run(input.slug,input.name,input.description,input.version,input.author,JSON.stringify(input.requiredToolIds)).lastInsertRowid);
  }

  upsertSkill(input: UpsertAutomationSkillInput): number {
    if (input.id) {
      const result = this.database.prepare(`UPDATE automation_skills SET slug=?,name=?,description=?,status=?,version=?,author=?,required_tool_ids_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
        input.slug,input.name,input.description,input.status,input.version,input.author,JSON.stringify(input.requiredToolIds),input.id,
      );
      if (!result.changes) throw new Error("Навык не найден");
      return input.id;
    }
    return Number(this.database.prepare(`INSERT INTO automation_skills(slug,name,description,status,version,author,required_tool_ids_json) VALUES(?,?,?,?,?,?,?)`).run(
      input.slug,input.name,input.description,input.status,input.version,input.author,JSON.stringify(input.requiredToolIds),
    ).lastInsertRowid);
  }

  deleteSkill(id: number): void {
    const result = this.database.prepare("DELETE FROM automation_skills WHERE id=?").run(id);
    if (!result.changes) throw new Error("Навык не найден");
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
