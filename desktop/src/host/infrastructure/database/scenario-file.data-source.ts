import type Database from "better-sqlite3";
import type {
  AttachmentReference,
  ScenarioFileReference,
} from "../../../shared/dto/scenario-trigger-event.dto";

export interface ScenarioFileJob {
  id: number;
  executionId: number;
  nodeRunId: number;
  nodeId: string;
  sourceKind: string;
  sourceExternalId: string;
  integrationProfileId: number | null;
  sourceScope: string;
  input: {
    attachment: AttachmentReference;
    entity: Record<string, unknown>;
    triggerBindingId: string;
    maxFileSizeBytes: number;
  };
  attempt: number;
  maxAttempts: number;
}

export class ScenarioFileDataSource {
  constructor(private readonly db: Database.Database) {}

  recoverExpiredLeases(): void {
    this.db.prepare(
      `UPDATE scenario_file_jobs SET status='queued',lease_owner=NULL,lease_expires_at=NULL,
       updated_at=CURRENT_TIMESTAMP WHERE status='leased'`,
    ).run();
  }

  enqueue(input: {
    executionId: number;
    nodeRunId: number;
    nodeId: string;
    sourceKind: string;
    sourceExternalId: string;
    integrationProfileId: number | null;
    sourceScope: string;
    payload: ScenarioFileJob["input"];
    cleanupOnFinish: boolean;
  }): void {
    this.db.prepare(
      `INSERT INTO scenario_file_jobs(
        execution_id,node_run_id,node_id,source_kind,source_external_id,
        integration_profile_id,source_scope,input_json,cleanup_on_finish
      ) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT
      DO UPDATE SET node_run_id=excluded.node_run_id,input_json=excluded.input_json,
        cleanup_on_finish=excluded.cleanup_on_finish,updated_at=CURRENT_TIMESTAMP`,
    ).run(
      input.executionId,
      input.nodeRunId,
      input.nodeId,
      input.sourceKind,
      input.sourceExternalId,
      input.integrationProfileId,
      input.sourceScope,
      JSON.stringify(input.payload),
      Number(input.cleanupOnFinish),
    );
    this.db.prepare(
      `UPDATE execution_files SET node_run_id=? WHERE job_id=(
        SELECT id FROM scenario_file_jobs WHERE execution_id=? AND node_id=?
          AND source_kind=? AND source_scope=? AND source_external_id=?
      )`,
    ).run(
      input.nodeRunId,
      input.executionId,
      input.nodeId,
      input.sourceKind,
      input.sourceScope,
      input.sourceExternalId,
    );
  }

  leaseNext(workerId: string): ScenarioFileJob | undefined {
    return this.db.transaction(() => {
      const row = this.db.prepare(
        `SELECT * FROM scenario_file_jobs WHERE status='queued'
         ORDER BY id LIMIT 1`,
      ).get() as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const changed = this.db.prepare(
        `UPDATE scenario_file_jobs SET status='leased',lease_owner=?,
         lease_expires_at=datetime('now','+5 minutes'),attempt=attempt+1,
         updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='queued'`,
      ).run(workerId, row.id).changes;
      return changed ? mapJob({ ...row, attempt: Number(row.attempt) + 1 }) : undefined;
    })();
  }

  complete(
    job: ScenarioFileJob,
    file: Omit<ScenarioFileReference, "id"> & { localPath: string },
  ): void {
    this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO execution_files(
          execution_id,node_run_id,job_id,source_kind,source_external_id,
          file_name,mime_type,size,sha256,storage_key,local_path
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        job.executionId,
        job.nodeRunId,
        job.id,
        job.sourceKind,
        job.sourceExternalId,
        file.fileName,
        file.mimeType,
        file.size,
        file.sha256,
        file.storageKey,
        file.localPath,
      );
      this.db.prepare(
        `UPDATE scenario_file_jobs SET status='completed',lease_owner=NULL,
         lease_expires_at=NULL,last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      ).run(job.id);
    })();
  }

  fail(job: ScenarioFileJob, error: string): void {
    this.db.prepare(
      `UPDATE scenario_file_jobs SET status=?,last_error=?,lease_owner=NULL,
       lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    ).run(job.attempt >= job.maxAttempts ? "failed" : "queued", error, job.id);
  }

  status(executionId: number, nodeRunId: number) {
    return this.db.prepare(
      `SELECT status,last_error FROM scenario_file_jobs
       WHERE execution_id=? AND node_run_id=? ORDER BY id`,
    ).all(executionId, nodeRunId) as Array<{
      status: "queued" | "leased" | "completed" | "failed" | "cancelled";
      last_error: string | null;
    }>;
  }

  files(executionId: number, nodeRunId: number): ScenarioFileReference[] {
    return (this.db.prepare(
      `SELECT id,file_name,mime_type,size,sha256,storage_key FROM execution_files
       WHERE execution_id=? AND node_run_id=? AND deleted_at IS NULL ORDER BY id`,
    ).all(executionId, nodeRunId) as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      fileName: String(row.file_name),
      mimeType: row.mime_type === null ? null : String(row.mime_type),
      size: Number(row.size),
      sha256: String(row.sha256),
      storageKey: String(row.storage_key),
    }));
  }

  cleanupCandidates(executionId: number): Array<{ id: number; localPath: string }> {
    return (this.db.prepare(
      `SELECT f.id,f.local_path FROM execution_files f
       JOIN scenario_file_jobs j ON j.id=f.job_id
       WHERE f.execution_id=? AND f.deleted_at IS NULL AND j.cleanup_on_finish=1`,
    ).all(executionId) as Array<{ id: number; local_path: string }>).map((row) => ({
      id: row.id,
      localPath: row.local_path,
    }));
  }

  terminalCleanupCandidates(): Array<{ id: number; localPath: string }> {
    return (this.db.prepare(
      `SELECT f.id,f.local_path FROM execution_files f
       JOIN scenario_file_jobs j ON j.id=f.job_id
       JOIN execution_runs r ON r.id=f.execution_id
       WHERE f.deleted_at IS NULL AND j.cleanup_on_finish=1
         AND r.status IN ('completed','failed','cancelled')
       ORDER BY f.id LIMIT 100`,
    ).all() as Array<{ id: number; local_path: string }>).map((row) => ({
      id: row.id,
      localPath: row.local_path,
    }));
  }

  markDeleted(id: number): void {
    this.db.prepare(
      "UPDATE execution_files SET deleted_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(id);
  }

  chatAttachment(id: number, conversationId: number) {
    const row = this.db.prepare(
      `SELECT local_path FROM chat_attachments
       WHERE id=? AND conversation_id=?`,
    ).get(id, conversationId) as { local_path: string } | undefined;
    return row ? { localPath: row.local_path } : undefined;
  }
}

function mapJob(row: Record<string, unknown>): ScenarioFileJob {
  return {
    id: Number(row.id),
    executionId: Number(row.execution_id),
    nodeRunId: Number(row.node_run_id),
    nodeId: String(row.node_id),
    sourceKind: String(row.source_kind),
    sourceExternalId: String(row.source_external_id),
    integrationProfileId:
      row.integration_profile_id === null
        ? null
        : Number(row.integration_profile_id),
    sourceScope: String(row.source_scope),
    input: JSON.parse(String(row.input_json)) as ScenarioFileJob["input"],
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
  };
}
