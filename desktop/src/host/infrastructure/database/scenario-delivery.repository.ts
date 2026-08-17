import { notifyWork } from "../automation/background/work-signal";
import type Database from "better-sqlite3";

export type ScenarioDeliveryChannel = "telegram" | "email";
export interface ScenarioDeliveryJob {
  id: number;
  executionId: number;
  nodeRunId: number;
  channel: ScenarioDeliveryChannel;
  integrationProfileId: number;
  recipient: string;
  payload: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
}

export class ScenarioDeliveryRepository {
  constructor(private readonly db: Database.Database) {}

  enqueue(
    input: Omit<ScenarioDeliveryJob, "id" | "attempt" | "maxAttempts"> & {
      idempotencyKey: string;
    },
  ) {
    this.db
      .prepare(
        `INSERT INTO scenario_delivery_outbox(
      execution_id,node_run_id,channel,integration_profile_id,recipient,payload_json,idempotency_key
    ) VALUES(?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING`,
      )
      .run(
        input.executionId,
        input.nodeRunId,
        input.channel,
        input.integrationProfileId,
        input.recipient,
        JSON.stringify(input.payload),
        input.idempotencyKey,
      );
    notifyWork("scenario-delivery");
  }

  recoverExpiredLeases(): number {
    const changed = this.db
      .prepare(
        `UPDATE scenario_delivery_outbox SET status='queued',lease_owner=NULL,lease_expires_at=NULL
      WHERE status='leased' AND (lease_expires_at IS NULL OR lease_expires_at < CURRENT_TIMESTAMP)`,
      )
      .run().changes;
    if (changed > 0) notifyWork("scenario-delivery");
    return changed;
  }

  recoverAllLeases(): number {
    return this.db
      .prepare(
        `UPDATE scenario_delivery_outbox SET status='queued',lease_owner=NULL,lease_expires_at=NULL
      WHERE status='leased'`,
      )
      .run().changes;
  }

  depth(): Record<string, number> {
    const rows = this.db
      .prepare(
        "SELECT status, COUNT(*) AS count FROM scenario_delivery_outbox GROUP BY status",
      )
      .all() as Array<{ status: string; count: number }>;
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  list(
    input: { status?: string; limit?: number } = {},
  ): Array<Record<string, unknown>> {
    const limit = Math.min(500, Math.max(1, input.limit ?? 100));
    const where = input.status ? "WHERE status=?" : "";
    const parameters = input.status ? [input.status, limit] : [limit];
    return this.db
      .prepare(
        `SELECT id,execution_id,channel,recipient,status,attempt,max_attempts,last_error,available_at,created_at,completed_at
         FROM scenario_delivery_outbox ${where} ORDER BY id DESC LIMIT ?`,
      )
      .all(...parameters) as Array<Record<string, unknown>>;
  }

  retry(id: number): boolean {
    const changed = this.db
      .prepare(
        `UPDATE scenario_delivery_outbox SET status='queued',attempt=0,last_error=NULL,
       lease_owner=NULL,lease_expires_at=NULL,available_at=CURRENT_TIMESTAMP
       WHERE id=? AND status='failed'`,
      )
      .run(id).changes;
    if (changed) notifyWork("scenario-delivery");
    return changed > 0;
  }

  leaseNext(owner: string): ScenarioDeliveryJob | undefined {
    return this.db.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT * FROM scenario_delivery_outbox
        WHERE status='queued' AND available_at<=CURRENT_TIMESTAMP ORDER BY id LIMIT 1`,
        )
        .get() as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const result = this.db
        .prepare(
          `UPDATE scenario_delivery_outbox SET status='leased',lease_owner=?,
        lease_expires_at=datetime('now','+2 minutes'),attempt=attempt+1 WHERE id=? AND status='queued'`,
        )
        .run(owner, row.id);
      if (!result.changes) return undefined;
      return mapJob({ ...row, attempt: Number(row.attempt) + 1 });
    })();
  }

  complete(id: number) {
    this.db
      .prepare(
        `UPDATE scenario_delivery_outbox SET status='completed',completed_at=CURRENT_TIMESTAMP,
      lease_owner=NULL,lease_expires_at=NULL,last_error=NULL WHERE id=?`,
      )
      .run(id);
  }

  fail(job: ScenarioDeliveryJob, error: string) {
    const terminal = job.attempt >= job.maxAttempts;
    const delay = Math.min(300, 2 ** job.attempt * 5);
    this.db
      .prepare(
        `UPDATE scenario_delivery_outbox SET status=?,available_at=datetime('now',?),
      lease_owner=NULL,lease_expires_at=NULL,last_error=? WHERE id=?`,
      )
      .run(terminal ? "failed" : "queued", `+${delay} seconds`, error, job.id);
  }
}

function mapJob(row: Record<string, unknown>): ScenarioDeliveryJob {
  return {
    id: Number(row.id),
    executionId: Number(row.execution_id),
    nodeRunId: Number(row.node_run_id),
    channel: row.channel as ScenarioDeliveryChannel,
    integrationProfileId: Number(row.integration_profile_id),
    recipient: String(row.recipient),
    payload: JSON.parse(String(row.payload_json)),
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
  };
}
