import type Database from "better-sqlite3";
import type {
  EntityGenerationRun,
  EntityGenerationStatus,
  GeneratedEntityKind,
} from "../../../shared/models/entity-generation";
import type { StartEntityGenerationInput } from "../../../shared/dto";

interface EntityGenerationRow {
  id: number;
  kind: GeneratedEntityKind;
  model_id: number;
  prompt: string;
  status: EntityGenerationStatus;
  entity_id: string | null;
  entity_name: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const COLUMNS = `id,kind,model_id,prompt,status,entity_id,entity_name,error_message,created_at,started_at,completed_at`;

export class EntityGenerationRepository {
  constructor(private readonly database: Database.Database) {}

  list(): EntityGenerationRun[] {
    const rows = this.database
      .prepare(
        `SELECT ${COLUMNS} FROM entity_generation_runs
         ORDER BY created_at DESC, id DESC`,
      )
      .all() as EntityGenerationRow[];
    return rows.map(mapRun);
  }

  find(id: number): EntityGenerationRun | undefined {
    const row = this.database
      .prepare(`SELECT ${COLUMNS} FROM entity_generation_runs WHERE id=?`)
      .get(id) as EntityGenerationRow | undefined;
    return row ? mapRun(row) : undefined;
  }

  create(input: StartEntityGenerationInput): EntityGenerationRun {
    const id = Number(
      this.database
        .prepare(
          `INSERT INTO entity_generation_runs(kind,model_id,prompt) VALUES(?,?,?)`,
        )
        .run(input.kind, input.modelId, input.prompt).lastInsertRowid,
    );
    return this.find(id)!;
  }

  markRunning(id: number): void {
    this.database
      .prepare(
        `UPDATE entity_generation_runs
         SET status='running',started_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(id);
  }

  markCompleted(id: number, entityId: string, entityName: string): void {
    this.database
      .prepare(
        `UPDATE entity_generation_runs
         SET status='completed',entity_id=?,entity_name=?,
             completed_at=CURRENT_TIMESTAMP WHERE id=?`,
      )
      .run(entityId, entityName, id);
  }

  markFailed(id: number, message: string): void {
    this.database
      .prepare(
        `UPDATE entity_generation_runs
         SET status='failed',error_message=?,completed_at=CURRENT_TIMESTAMP
         WHERE id=?`,
      )
      .run(message, id);
  }

  recoverInterrupted(): void {
    this.database
      .prepare(
        `UPDATE entity_generation_runs
         SET status='failed',
             error_message='Генерация прервана перезапуском приложения',
             completed_at=CURRENT_TIMESTAMP
         WHERE status IN ('queued','running')`,
      )
      .run();
  }
}

function mapRun(row: EntityGenerationRow): EntityGenerationRun {
  return {
    id: row.id,
    kind: row.kind,
    modelId: row.model_id,
    prompt: row.prompt,
    status: row.status,
    entityId: row.entity_id,
    entityName: row.entity_name,
    error: row.error_message,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}
