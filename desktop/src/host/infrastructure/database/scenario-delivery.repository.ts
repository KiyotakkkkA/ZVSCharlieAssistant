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
  }

  recoverExpiredLeases() {
    this.db
      .prepare(
        `UPDATE scenario_delivery_outbox SET status='queued',lease_owner=NULL,lease_expires_at=NULL
      WHERE status='leased' AND lease_expires_at<CURRENT_TIMESTAMP`,
      )
      .run();
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
