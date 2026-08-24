import type Database from "better-sqlite3";
import { BASELINE_SCHEMA_SQL } from "./baseline-schema";
import { CODER_MODE_SCHEMA_SQL } from "./coder-mode-schema";
import { MODEL_CHAIN_SCHEMA_SQL } from "./model-chain-schema";
import { PROJECT_SCHEMA_SQL } from "./project-schema";

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  { version: 1, name: "baseline", sql: BASELINE_SCHEMA_SQL },
  { version: 2, name: "coder-mode", sql: CODER_MODE_SCHEMA_SQL },
  { version: 3, name: "model-chain", sql: MODEL_CHAIN_SCHEMA_SQL },
  { version: 4, name: "projects", sql: PROJECT_SCHEMA_SQL },
];

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const isApplied = database.prepare(
    "SELECT 1 FROM schema_migrations WHERE version=?",
  );
  const markApplied = database.prepare(
    "INSERT INTO schema_migrations(version) VALUES(?)",
  );

  for (const migration of MIGRATIONS) {
    if (isApplied.get(migration.version)) continue;
    database.transaction(() => {
      database.exec(migration.sql);
      markApplied.run(migration.version);
    })();
  }
}
