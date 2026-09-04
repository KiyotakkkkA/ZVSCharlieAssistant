import type Database from "better-sqlite3";

export interface RecordedEffect {
  key: string;
  result: unknown;
}

export class ScenarioEffectRepository {
  constructor(private readonly db: Database.Database) {}

  find(idempotencyKey: string): RecordedEffect | undefined {
    const row = this.db
      .prepare(
        `SELECT idempotency_key,result_json FROM scenario_effects WHERE idempotency_key=?`,
      )
      .get(idempotencyKey) as
      { idempotency_key: string; result_json: string | null } | undefined;
    if (!row) return undefined;
    return {
      key: row.idempotency_key,
      result: row.result_json === null ? null : JSON.parse(row.result_json),
    };
  }

  record(input: {
    idempotencyKey: string;
    executionId: string;
    nodeId: string;
    kind: string;
    result: unknown;
  }): void {
    this.db
      .prepare(
        `INSERT INTO scenario_effects(idempotency_key,execution_id,node_id,kind,result_json)
       VALUES(?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING`,
      )
      .run(
        input.idempotencyKey,
        input.executionId,
        input.nodeId,
        input.kind,
        input.result === undefined ? null : JSON.stringify(input.result),
      );
  }
}
