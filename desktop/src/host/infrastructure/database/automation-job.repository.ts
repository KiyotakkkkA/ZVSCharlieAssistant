import { notifyWork } from "../automation/background/work-signal";
import type Database from "better-sqlite3";

export interface AutomationJob {
  id: number;
  kind: "scenario_run";
  payload: Record<string, unknown>;
  attempt: number;
  maxAttempts: number;
}

export class AutomationJobRepository {
  constructor(private readonly db: Database.Database) {}

  recoverExpiredLeases(): number {
    const result = this.db
      .prepare(
        `UPDATE automation_jobs SET status='queued',lease_owner=NULL,lease_expires_at=NULL,
       available_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
       WHERE status='leased' AND (lease_expires_at IS NULL OR lease_expires_at < CURRENT_TIMESTAMP)`,
      )
      .run();
    if (result.changes > 0) notifyWork("scenario-job");
    return result.changes;
  }

  recoverAllLeases(): number {
    return this.db
      .prepare(
        `UPDATE automation_jobs SET status='queued',lease_owner=NULL,lease_expires_at=NULL,
       available_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE status='leased'`,
      )
      .run().changes;
  }

  renewLease(id: number, workerId: string, seconds = 120): boolean {
    return (
      this.db
        .prepare(
          `UPDATE automation_jobs SET lease_expires_at=datetime('now','+' || ? || ' seconds'),
         updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_owner=? AND status='leased'`,
        )
        .run(seconds, id, workerId).changes > 0
    );
  }

  depth(): Record<string, number> {
    const rows = this.db
      .prepare(
        "SELECT status, COUNT(*) AS count FROM automation_jobs GROUP BY status",
      )
      .all() as Array<{ status: string; count: number }>;
    return Object.fromEntries(rows.map((row) => [row.status, row.count]));
  }

  list(
    input: { status?: string; limit?: number } = {},
  ): Array<Record<string, unknown>> {
    const limit = Math.min(500, Math.max(1, input.limit ?? 100));
    return input.status
      ? (this.db
          .prepare(
            `SELECT id,kind,status,attempt,max_attempts,priority,last_error,available_at,created_at,updated_at,payload_json
             FROM automation_jobs WHERE status=? ORDER BY id DESC LIMIT ?`,
          )
          .all(input.status, limit) as Array<Record<string, unknown>>)
      : (this.db
          .prepare(
            `SELECT id,kind,status,attempt,max_attempts,priority,last_error,available_at,created_at,updated_at,payload_json
             FROM automation_jobs ORDER BY id DESC LIMIT ?`,
          )
          .all(limit) as Array<Record<string, unknown>>);
  }

  retry(id: number): boolean {
    const changed = this.db
      .prepare(
        `UPDATE automation_jobs SET status='queued',attempt=0,last_error=NULL,lease_owner=NULL,
       lease_expires_at=NULL,available_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND status IN ('failed','cancelled')`,
      )
      .run(id).changes;
    if (changed) notifyWork("scenario-job");
    return changed > 0;
  }

  cancel(id: number): boolean {
    return (
      this.db
        .prepare(
          `UPDATE automation_jobs SET status='cancelled',lease_owner=NULL,lease_expires_at=NULL,
         updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('queued','waiting','failed')`,
        )
        .run(id).changes > 0
    );
  }

  enqueue(
    kind: AutomationJob["kind"],
    key: string,
    payload: unknown,
    priority = 0,
  ): void {
    this.db
      .prepare(
        `INSERT INTO automation_jobs(kind,deduplication_key,payload_json,priority)
       VALUES(?,?,?,?) ON CONFLICT(deduplication_key) DO NOTHING`,
      )
      .run(kind, key, JSON.stringify(payload), priority);
    notifyWork("scenario-job");
  }

  leaseNext(workerId: string): AutomationJob | undefined {
    return this.db.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT id,kind,payload_json,attempt,max_attempts FROM automation_jobs
         WHERE status='queued' AND available_at<=CURRENT_TIMESTAMP
         ORDER BY priority DESC,id LIMIT 1`,
        )
        .get() as
        | {
            id: number;
            kind: AutomationJob["kind"];
            payload_json: string;
            attempt: number;
            max_attempts: number;
          }
        | undefined;
      if (!row) return undefined;
      const changed = this.db
        .prepare(
          `UPDATE automation_jobs SET status='leased',lease_owner=?,lease_expires_at=datetime('now','+2 minutes'),
         attempt=attempt+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='queued'`,
        )
        .run(workerId, row.id).changes;
      return changed
        ? {
            id: row.id,
            kind: row.kind,
            payload: JSON.parse(row.payload_json),
            attempt: row.attempt + 1,
            maxAttempts: row.max_attempts,
          }
        : undefined;
    })();
  }

  complete(id: number): void {
    this.db
      .prepare(
        "UPDATE automation_jobs SET status='completed',lease_owner=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(id);
  }

  updatePayload(id: number, payload: unknown): void {
    this.db
      .prepare(
        "UPDATE automation_jobs SET payload_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(JSON.stringify(payload), id);
  }

  fail(job: AutomationJob, error: string, retryable = true): void {
    const terminal = !retryable || job.attempt >= job.maxAttempts;
    this.db
      .prepare(
        `UPDATE automation_jobs SET status=?,last_error=?,lease_owner=NULL,lease_expires_at=NULL,
       available_at=datetime('now',?),updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(
        terminal ? "failed" : "queued",
        error,
        `+${Math.min(300, 2 ** job.attempt)} seconds`,
        job.id,
      );
  }
}
