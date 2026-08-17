import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  scenarioGraphSchema,
  type ScenarioGraph,
} from "../../../shared/scenario/graph";
import {
  automationScenarioToolSettingDtoSchema,
  parseJsonDto,
  type AutomationScenarioToolSetting,
} from "../../../shared/dto";

export interface ScenarioDefinitionV2 {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "disabled";
  graph: ScenarioGraph;
  toolSettings: AutomationScenarioToolSetting[];
  revisionId: number;
  version: number;
  nodesCount: number;
  lastRunAt: string | null;
  updatedAt: string;
}

export interface UpsertScenarioV2Input {
  id?: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "disabled";
  graph: ScenarioGraph;
  toolSettings?: AutomationScenarioToolSetting[];
}

interface ScenarioRow {
  id: string;
  name: string;
  description: string;
  status: ScenarioDefinitionV2["status"];
  revision_id: number;
  version: number;
  graph_json: string;
  tool_settings_json: string;
  last_run_at: string | null;
  updated_at: string;
}

const STATUSES = new Set(["draft", "active", "disabled"]);

export class ScenarioGraphRepository {
  constructor(private readonly db: Database.Database) {}

  list(): ScenarioDefinitionV2[] {
    const rows = this.db
      .prepare(
        `SELECT s.id, s.name, s.description, s.status, r.id AS revision_id,
                r.version, r.graph_json, r.tool_settings_json, s.last_run_at, s.updated_at
         FROM automation_scenarios s
         JOIN automation_scenario_revisions r ON r.id = s.active_revision_id
         ORDER BY updated_at DESC, name ASC`,
      )
      .all() as ScenarioRow[];
    return rows.map(mapRow);
  }

  find(id: string, revisionId?: number): ScenarioDefinitionV2 | undefined {
    const row = this.db
      .prepare(
        `SELECT s.id, s.name, s.description, s.status, r.id AS revision_id,
                r.version, r.graph_json, r.tool_settings_json, s.last_run_at, s.updated_at
         FROM automation_scenarios s
         JOIN automation_scenario_revisions r
           ON r.scenario_id = s.id AND r.id = COALESCE(?, s.active_revision_id)
         WHERE s.id = ?`,
      )
      .get(revisionId ?? null, id) as ScenarioRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  upsert(input: UpsertScenarioV2Input): ScenarioDefinitionV2 {
    if (!STATUSES.has(input.status))
      throw new Error("Недопустимый статус сценария");
    const graph = scenarioGraphSchema.parse(input.graph);
    const id = input.id ?? randomUUID();
    if (input.id && !this.find(input.id)) throw new Error("Сценарий не найден");
    const name = input.name.trim().slice(0, 120) || "Без названия";
    const description = (input.description ?? "").trim().slice(0, 1_000);

    this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO automation_scenarios (id, name, description, status)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, description = excluded.description,
             status = excluded.status, updated_at = CURRENT_TIMESTAMP`,
        )
        .run(id, name, description, input.status);

      const version = (
        this.db
          .prepare(
            "SELECT COALESCE(MAX(version), 0) + 1 AS version FROM automation_scenario_revisions WHERE scenario_id = ?",
          )
          .get(id) as { version: number }
      ).version;

      const toolSettings = input.toolSettings ?? [];
      const revisionId = Number(
        this.db
          .prepare(
            `INSERT INTO automation_scenario_revisions
               (scenario_id, version, graph_json, tool_settings_json)
             VALUES (?, ?, ?, ?)`,
          )
          .run(id, version, JSON.stringify(graph), JSON.stringify(toolSettings))
          .lastInsertRowid,
      );

      this.db
        .prepare(
          "UPDATE automation_scenarios SET active_revision_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(revisionId, id);
    })();

    return this.find(id)!;
  }

  delete(id: string): void {
    const result = this.db
      .prepare("DELETE FROM automation_scenarios WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new Error("Сценарий не найден");
  }
}

function mapRow(row: ScenarioRow): ScenarioDefinitionV2 {
  const graph = scenarioGraphSchema.parse(JSON.parse(row.graph_json));
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    graph,
    toolSettings: parseJsonDto(
      automationScenarioToolSettingDtoSchema.array(),
      row.tool_settings_json ?? "[]",
    ),
    revisionId: row.revision_id,
    version: row.version,
    nodesCount: graph.nodes.length,
    lastRunAt: row.last_run_at,
    updatedAt: row.updated_at,
  };
}
