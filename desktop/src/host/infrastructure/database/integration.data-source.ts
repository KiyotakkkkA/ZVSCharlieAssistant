import type Database from "better-sqlite3";
import type {
  IntegrationConnectionMetadata,
  IntegrationProfile,
  IntegrationSnapshot,
} from "../../../shared/models/integration";
import type {
  ScenarioTriggerConfig,
  UpsertIntegrationProfileInput,
} from "../../../shared/dto";

type ProfileRow = {
  id: number;
  kind: IntegrationProfile["kind"];
  name: string;
  enabled: number;
  config_json: string;
  status: IntegrationProfile["status"];
  checked_at: string | null;
  last_error: string | null;
  connection_metadata_json: string;
  created_at: string;
  updated_at: string;
};

export interface DueTriggerBinding {
  id: string;
  scenarioId: string;
  scenarioRevisionId: number;
  kind: "telegram" | "email" | "interval";
  integrationProfileId: number | null;
  config: Record<string, unknown>;
  nextRunAt: string | null;
}

export class IntegrationDataSource {
  constructor(private readonly db: Database.Database) {}

  snapshot(): IntegrationSnapshot {
    return { profiles: this.listProfiles() };
  }

  listProfiles(): IntegrationProfile[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM integration_profiles ORDER BY updated_at DESC, name",
      )
      .all() as ProfileRow[];
    const bindings = this.db
      .prepare(
        "SELECT profile_id,binding_key,secret_id FROM integration_secret_bindings",
      )
      .all() as Array<{
      profile_id: number;
      binding_key: string;
      secret_id: number;
    }>;
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      name: row.name,
      enabled: Boolean(row.enabled),
      config: JSON.parse(row.config_json),
      secretBindings: Object.fromEntries(
        bindings
          .filter((item) => item.profile_id === row.id)
          .map((item) => [item.binding_key, item.secret_id]),
      ),
      status: row.status,
      checkedAt: row.checked_at,
      lastError: row.last_error,
      connectionMetadata: JSON.parse(row.connection_metadata_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  findProfile(id: number): IntegrationProfile | undefined {
    return this.listProfiles().find((item) => item.id === id);
  }

  upsertProfile(input: UpsertIntegrationProfileInput): IntegrationProfile {
    const id = this.db.transaction(() => {
      const profileId =
        input.id ??
        Number(
          this.db
            .prepare(
              `INSERT INTO integration_profiles(kind,name,enabled,config_json,status)
           VALUES(?,?,?,?,'unchecked')`,
            )
            .run(
              input.kind,
              input.name,
              Number(input.enabled),
              JSON.stringify(input.config),
            ).lastInsertRowid,
        );
      if (input.id) {
        const result = this.db
          .prepare(
            `UPDATE integration_profiles SET kind=?,name=?,enabled=?,config_json=?,
           updated_at=CURRENT_TIMESTAMP WHERE id=?`,
          )
          .run(
            input.kind,
            input.name,
            Number(input.enabled),
            JSON.stringify(input.config),
            input.id,
          );
        if (!result.changes) throw new Error("Профиль интеграции не найден");
      }
      this.db
        .prepare("DELETE FROM integration_secret_bindings WHERE profile_id=?")
        .run(profileId);
      const insert = this.db.prepare(
        "INSERT INTO integration_secret_bindings(profile_id,binding_key,secret_id) VALUES(?,?,?)",
      );
      for (const [key, secretId] of Object.entries(input.secretBindings))
        insert.run(profileId, key, secretId);
      return profileId;
    })();
    return this.findProfile(id)!;
  }

  deleteProfile(id: number): void {
    const result = this.db
      .prepare("DELETE FROM integration_profiles WHERE id=?")
      .run(id);
    if (!result.changes) throw new Error("Профиль интеграции не найден");
  }

  setConnectionResult(
    id: number,
    ok: boolean,
    error?: string,
    metadata: IntegrationConnectionMetadata = {},
  ): void {
    this.db
      .prepare(
        `UPDATE integration_profiles SET status=?,checked_at=CURRENT_TIMESTAMP,last_error=?,
       connection_metadata_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(
        ok ? "connected" : "error",
        error ?? null,
        JSON.stringify(ok ? metadata : {}),
        id,
      );
  }

  syncScenarioBindings(
    scenarioId: string,
    revisionId: number,
    triggerNodeId: string,
    config: ScenarioTriggerConfig,
  ): void {
    this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM scenario_trigger_bindings WHERE scenario_id=?")
        .run(scenarioId);
      const insert = this.db.prepare(
        `INSERT INTO scenario_trigger_bindings
         (id,scenario_id,scenario_revision_id,trigger_node_id,kind,integration_profile_id,enabled,config_json,next_run_at)
         VALUES(?,?,?,?,?,?,?,?,?)`,
      );
      if (config.manual.chatEnabled)
        insert.run(
          `${scenarioId}:manual_chat`,
          scenarioId,
          revisionId,
          triggerNodeId,
          "manual_chat",
          null,
          1,
          "{}",
          null,
        );
      if (config.manual.editorEnabled)
        insert.run(
          `${scenarioId}:manual_editor`,
          scenarioId,
          revisionId,
          triggerNodeId,
          "manual_editor",
          null,
          1,
          "{}",
          null,
        );
      for (const item of config.automatic) {
        const nextRunAt =
          item.kind === "interval"
            ? new Date(Date.now() + item.intervalSeconds * 1000).toISOString()
            : null;
        insert.run(
          `${scenarioId}:${item.id}`,
          scenarioId,
          revisionId,
          triggerNodeId,
          item.kind,
          "integrationProfileId" in item ? item.integrationProfileId : null,
          Number(item.enabled),
          JSON.stringify(item),
          nextRunAt,
        );
      }
    })();
  }

  dueIntervalBindings(now: string): DueTriggerBinding[] {
    return (
      this.db
        .prepare(
          `SELECT id,scenario_id,scenario_revision_id,kind,integration_profile_id,config_json,next_run_at
       FROM scenario_trigger_bindings WHERE kind='interval' AND enabled=1 AND next_run_at<=?`,
        )
        .all(now) as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      scenarioId: String(row.scenario_id),
      scenarioRevisionId: Number(row.scenario_revision_id),
      kind: row.kind as "interval",
      integrationProfileId:
        row.integration_profile_id === null
          ? null
          : Number(row.integration_profile_id),
      config: JSON.parse(String(row.config_json)),
      nextRunAt: row.next_run_at === null ? null : String(row.next_run_at),
    }));
  }

  bindings(kind: "telegram" | "email"): DueTriggerBinding[] {
    return (
      this.db
        .prepare(
          `SELECT b.id,b.scenario_id,b.scenario_revision_id,b.kind,b.integration_profile_id,b.config_json,b.next_run_at
       FROM scenario_trigger_bindings b
       JOIN automation_scenarios s ON s.id=b.scenario_id
       JOIN integration_profiles p ON p.id=b.integration_profile_id
       WHERE b.kind=? AND b.enabled=1 AND s.status='active' AND p.enabled=1`,
        )
        .all(kind) as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      scenarioId: String(row.scenario_id),
      scenarioRevisionId: Number(row.scenario_revision_id),
      kind: row.kind as "telegram" | "email",
      integrationProfileId: Number(row.integration_profile_id),
      config: JSON.parse(String(row.config_json)),
      nextRunAt: null,
    }));
  }

  cursor(bindingId: string): Record<string, unknown> {
    const row = this.db
      .prepare("SELECT cursor_json FROM trigger_cursors WHERE binding_id=?")
      .get(bindingId) as { cursor_json: string } | undefined;
    return row ? JSON.parse(row.cursor_json) : {};
  }

  setCursor(bindingId: string, cursor: unknown, error?: string): void {
    this.db
      .prepare(
        `INSERT INTO trigger_cursors(binding_id,cursor_json,polled_at,last_event_at,last_error)
       VALUES(?,?,CURRENT_TIMESTAMP,CASE WHEN ? IS NULL THEN CURRENT_TIMESTAMP ELSE NULL END,?)
       ON CONFLICT(binding_id) DO UPDATE SET cursor_json=excluded.cursor_json,
       polled_at=CURRENT_TIMESTAMP,last_event_at=CASE WHEN excluded.last_error IS NULL THEN CURRENT_TIMESTAMP ELSE last_event_at END,
       last_error=excluded.last_error`,
      )
      .run(bindingId, JSON.stringify(cursor), error ?? null, error ?? null);
  }

  advanceInterval(
    id: string,
    intervalSeconds: number,
    from = Date.now(),
  ): void {
    this.db
      .prepare(
        "UPDATE scenario_trigger_bindings SET next_run_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(new Date(from + intervalSeconds * 1000).toISOString(), id);
  }

  scenarioHasActiveRun(scenarioId: string): boolean {
    return Boolean(
      this.db
        .prepare(
          `SELECT 1 FROM execution_runs WHERE scenario_id=? AND status IN ('queued','running','waiting_for_approval') LIMIT 1`,
        )
        .get(scenarioId),
    );
  }

  hasManualBinding(
    scenarioId: string,
    kind: "manual_chat" | "manual_editor",
  ): boolean {
    return Boolean(
      this.db
        .prepare(
          `SELECT 1 FROM scenario_trigger_bindings b JOIN automation_scenarios s ON s.id=b.scenario_id
       WHERE b.scenario_id=? AND b.kind=? AND b.enabled=1
       AND ((?='manual_chat' AND s.status='active') OR (?='manual_editor' AND s.status<>'disabled'))`,
        )
        .get(scenarioId, kind, kind, kind),
    );
  }
}
