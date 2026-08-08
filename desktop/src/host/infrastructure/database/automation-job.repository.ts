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

  recoverExpiredLeases(): void {
    this.db
      .prepare(
        `UPDATE automation_jobs SET status='queued',lease_owner=NULL,lease_expires_at=NULL,
       available_at=CURRENT_TIMESTAMP WHERE status='leased'`,
      )
      .run();
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

  fail(job: AutomationJob, error: string): void {
    const terminal = job.attempt >= job.maxAttempts;
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
