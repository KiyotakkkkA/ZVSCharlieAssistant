import type Database from "better-sqlite3";
import type { FileEditRecord } from "../../../shared/models/chat";
import { newEntityId } from "./entity-id";

interface EditRow {
  id: string;
  run_id: string | null;
  conversation_id: string | null;
  path: string;
  operation: FileEditRecord["operation"];
  moved_to: string | null;
  diff: string;
  bytes_before: number;
  bytes_after: number;
  reverted: number;
  created_at: string;
}

export interface CheckpointRecord {
  id: string;
  runId: string | null;
  path: string;
  existed: boolean;
  backupPath: string | null;
  bytesBefore: number;
}

export class FileEditRepository {
  constructor(private readonly db: Database.Database) {}

  ensureCheckpoint(input: {
    runId: string | null;
    conversationId: string | null;
    path: string;
    existed: boolean;
    backupPath: string | null;
    bytesBefore: number;
  }): CheckpointRecord {
    const existing = input.runId
      ? (this.db
          .prepare(
            "SELECT id,run_id,path,existed,backup_path,bytes_before FROM file_checkpoints WHERE run_id=? AND path=? ORDER BY id LIMIT 1",
          )
          .get(input.runId, input.path) as
          | {
              id: string;
              run_id: string | null;
              path: string;
              existed: number;
              backup_path: string | null;
              bytes_before: number;
            }
          | undefined)
      : undefined;
    if (existing)
      return {
        id: existing.id,
        runId: existing.run_id,
        path: existing.path,
        existed: Boolean(existing.existed),
        backupPath: existing.backup_path,
        bytesBefore: existing.bytes_before,
      };

    const id = newEntityId();
    this.db
      .prepare(
        `INSERT INTO file_checkpoints(id,run_id,conversation_id,path,existed,backup_path,bytes_before)
         VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.runId,
        input.conversationId,
        input.path,
        input.existed ? 1 : 0,
        input.backupPath,
        input.bytesBefore,
      );
    return {
      id,
      runId: input.runId,
      path: input.path,
      existed: input.existed,
      backupPath: input.backupPath,
      bytesBefore: input.bytesBefore,
    };
  }

  recordEdit(input: {
    runId: string | null;
    conversationId: string | null;
    checkpointId: string | null;
    toolCallId: string | null;
    path: string;
    operation: FileEditRecord["operation"];
    movedTo?: string | null;
    diff: string;
    bytesBefore: number;
    bytesAfter: number;
  }): FileEditRecord {
    const id = newEntityId();
    this.db
      .prepare(
        `INSERT INTO file_edits(id,run_id,conversation_id,checkpoint_id,tool_call_id,path,operation,moved_to,diff,bytes_before,bytes_after)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.runId,
        input.conversationId,
        input.checkpointId,
        input.toolCallId,
        input.path,
        input.operation,
        input.movedTo ?? null,
        input.diff,
        input.bytesBefore,
        input.bytesAfter,
      );
    return this.byId(id);
  }

  byId(id: string): FileEditRecord {
    return map(
      this.db.prepare("SELECT * FROM file_edits WHERE id=?").get(id) as EditRow,
    );
  }

  listByRun(runId: string): FileEditRecord[] {
    return (
      this.db
        .prepare("SELECT * FROM file_edits WHERE run_id=? ORDER BY id")
        .all(runId) as EditRow[]
    ).map(map);
  }

  listByConversation(conversationId: string, limit = 200): FileEditRecord[] {
    return (
      this.db
        .prepare(
          "SELECT * FROM file_edits WHERE conversation_id=? ORDER BY id DESC LIMIT ?",
        )
        .all(conversationId, limit) as EditRow[]
    )
      .map(map)
      .reverse();
  }

  checkpointsForRun(runId: string): CheckpointRecord[] {
    return (
      this.db
        .prepare(
          "SELECT id,run_id,path,existed,backup_path,bytes_before FROM file_checkpoints WHERE run_id=? ORDER BY id",
        )
        .all(runId) as Array<{
        id: string;
        run_id: string | null;
        path: string;
        existed: number;
        backup_path: string | null;
        bytes_before: number;
      }>
    ).map((row) => ({
      id: row.id,
      runId: row.run_id,
      path: row.path,
      existed: Boolean(row.existed),
      backupPath: row.backup_path,
      bytesBefore: row.bytes_before,
    }));
  }

  markReverted(runId: string) {
    this.db
      .prepare("UPDATE file_edits SET reverted=1 WHERE run_id=?")
      .run(runId);
  }
}

const map = (row: EditRow): FileEditRecord => ({
  id: row.id,
  runId: row.run_id,
  conversationId: row.conversation_id,
  path: row.path,
  operation: row.operation,
  movedTo: row.moved_to,
  diff: row.diff,
  bytesBefore: row.bytes_before,
  bytesAfter: row.bytes_after,
  reverted: Boolean(row.reverted),
  createdAt: row.created_at,
});
