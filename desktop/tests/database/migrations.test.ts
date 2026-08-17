import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";

let database: Database.Database | undefined;

afterEach(() => database?.close());

describe("migration 19", () => {
  it("replaces conversation model_id and records per-message usage", () => {
    database = new Database(":memory:");
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT);
      ${Array.from({ length: 18 }, (_, index) =>
        `INSERT INTO schema_migrations(version) VALUES(${index + 1});`,
      ).join("\n")}
      CREATE TABLE automation_agents (id TEXT PRIMARY KEY);
      CREATE TABLE chat_conversations (
        id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT 'Новый диалог',
        mode TEXT NOT NULL, agent_id TEXT, model_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE generation_runs (
        id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL,
        agent_id TEXT, model_id INTEGER NOT NULL
      );
      CREATE TABLE execution_runs (id INTEGER PRIMARY KEY, scenario_id TEXT NOT NULL);
      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, run_id INTEGER,
        execution_run_id INTEGER, role TEXT NOT NULL, status TEXT NOT NULL,
        content_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
      );
      INSERT INTO chat_conversations(id, title, mode, model_id) VALUES(1, 'Диалог', 'chat', 7);
      INSERT INTO generation_runs(id, conversation_id, model_id) VALUES(10, 1, 9);
      INSERT INTO chat_messages(id, conversation_id, run_id, role, status, content_json)
      VALUES(100, 1, 10, 'assistant', 'completed', '[]');
    `);

    runMigrations(database);

    const columns = database
      .prepare("PRAGMA table_info(chat_conversations)")
      .all() as Array<{ name: string }>;
    expect(columns.map(({ name }) => name)).toContain("last_usage");
    expect(columns.map(({ name }) => name)).not.toContain("model_id");
    const message = database
      .prepare("SELECT last_usage FROM chat_messages WHERE id=100")
      .get() as { last_usage: string };
    expect(JSON.parse(message.last_usage)).toMatchObject({
      mode: "chat",
      modelId: 9,
    });
  });
});
