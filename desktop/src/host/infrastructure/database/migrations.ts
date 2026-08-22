import type Database from "better-sqlite3";
import { BASELINE_SCHEMA_SQL } from "./baseline-schema";

const BASELINE_VERSION = 1;

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = database
    .prepare("SELECT 1 FROM schema_migrations WHERE version=?")
    .get(BASELINE_VERSION);
  if (applied) return;

  database.transaction(() => {
    database.exec(BASELINE_SCHEMA_SQL);
    database
      .prepare("INSERT INTO schema_migrations(version) VALUES(?)")
      .run(BASELINE_VERSION);
  })();
}
