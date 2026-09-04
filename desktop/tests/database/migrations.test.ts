import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { SCHEMA_GENERATION } from "../../src/host/infrastructure/database/baseline-schema";
import {
  GLOBAL_ENTITY_IDS,
  SYSTEM_SECRET_CATEGORY_IDS,
} from "../../src/shared/entity-ids";

let database: Database.Database | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("UUID baseline schema", () => {
  it("uses one clean baseline and stable UUID identities", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);

    expect(
      database.prepare("SELECT COUNT(*) count FROM schema_migrations").get(),
    ).toEqual({ count: 10 });
    expect(
      database
        .prepare(
          "SELECT value FROM schema_metadata WHERE key='schema_generation'",
        )
        .get(),
    ).toEqual({ value: SCHEMA_GENERATION });

    const ids = database
      .prepare(
        "SELECT id,system_key FROM secret_categories ORDER BY system_key",
      )
      .all() as Array<{ id: string; system_key: string }>;
    expect(ids).toContainEqual({
      id: SYSTEM_SECRET_CATEGORY_IDS.apiKeys,
      system_key: "api-keys",
    });
    expect(ids).toContainEqual({
      id: SYSTEM_SECRET_CATEGORY_IDS.personalData,
      system_key: "personal-data",
    });

    expect(
      database.prepare("SELECT id FROM terminal_policy").pluck().get(),
    ).toBe(GLOBAL_ENTITY_IDS.terminalPolicy);
    expect(database.prepare("SELECT id FROM memory_policy").pluck().get()).toBe(
      GLOBAL_ENTITY_IDS.memoryPolicy,
    );

    const tables = database
      .prepare(
        `SELECT name FROM sqlite_master
         WHERE type='table' AND name NOT LIKE 'sqlite_%'
           AND name NOT LIKE 'memory_search%'`,
      )
      .pluck()
      .all() as string[];
    for (const table of tables) {
      const idColumn = (
        database.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
          name: string;
          type: string;
        }>
      ).find(({ name }) => name === "id");
      if (idColumn) expect(idColumn.type, `${table}.id`).toBe("TEXT");
    }
    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("adds coder-mode storage: сегменты сжатия и журнал правок", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .pluck()
      .all() as string[];
    expect(tables).toContain("context_segments");
    expect(tables).toContain("file_checkpoints");
    expect(tables).toContain("file_edits");

    const messageColumns = (
      database.prepare("PRAGMA table_info(chat_messages)").all() as Array<{
        name: string;
      }>
    ).map(({ name }) => name);
    expect(messageColumns).toContain("compacted_into");
    expect(messageColumns).toContain("token_count");

    const runColumns = (
      database.prepare("PRAGMA table_info(generation_runs)").all() as Array<{
        name: string;
      }>
    ).map(({ name }) => name);
    expect(runColumns).toContain("cost_usd");
    expect(runColumns).toContain("reasoning_tokens");
    expect(runColumns).toContain("model_switches_json");
  });

  it("adds project storage: проекты и их гранты", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .pluck()
      .all() as string[];
    expect(tables).toContain("projects");
    expect(tables).toContain("project_directory_grants");

    const conversationColumns = (
      database.prepare("PRAGMA table_info(chat_conversations)").all() as Array<{
        name: string;
      }>
    ).map(({ name }) => name);
    expect(conversationColumns).toContain("project_id");

    const memoryColumns = (
      database.prepare("PRAGMA table_info(memory_entries)").all() as Array<{
        name: string;
      }>
    ).map(({ name }) => name);
    expect(memoryColumns).toContain("project_id");
  });

  it("keeps an integer rowid only as the private FTS5 bridge", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);

    const columns = database
      .prepare("PRAGMA table_info(memory_entries)")
      .all() as Array<{ name: string; type: string; pk: number }>;
    expect(columns.find(({ name }) => name === "id")).toMatchObject({
      type: "TEXT",
    });
    expect(columns.find(({ name }) => name === "search_rowid")).toMatchObject({
      type: "INTEGER",
      pk: 1,
    });

    const id = "019cba09-8f30-7000-8000-000000000001";
    database
      .prepare("INSERT INTO memory_entries(id,title,content) VALUES(?,?,?)")
      .run(id, "SQLite", "Стабильный полнотекстовый поиск");
    expect(
      database
        .prepare(
          `SELECT e.id FROM memory_search s
           JOIN memory_entries e ON e.search_rowid=s.rowid
           WHERE memory_search MATCH 'полнотекстовый'`,
        )
        .pluck()
        .get(),
    ).toBe(id);
  });

  it("raises the legacy default output limit for existing providers", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);
    database
      .prepare(
        `INSERT INTO text_provider_configs(
           id,kind,name,base_url,enabled,checked_at,generation_settings_json
         ) VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        "provider-1",
        "ollama",
        "Legacy Ollama",
        "http://localhost:11434",
        1,
        new Date().toISOString(),
        JSON.stringify({ maxOutputTokens: 2048, temperature: 0.7, topP: 0.9 }),
      );
    database.prepare("DELETE FROM schema_migrations WHERE version=5").run();

    runMigrations(database);

    const limits = database
      .prepare(
        `SELECT json_extract(generation_settings_json, '$.maxOutputTokens')
         FROM text_provider_configs`,
      )
      .pluck()
      .all() as number[];
    expect(limits.length).toBeGreaterThan(0);
    expect(limits.every((value) => value === 8192)).toBe(true);
  });

  it("расширяет entity_generation_runs и user_questions для сценариев и уточнений", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);

    database
      .prepare(
        `INSERT INTO text_provider_configs(
           id,kind,name,base_url,enabled,checked_at,generation_settings_json
         ) VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        "provider-1",
        "ollama",
        "Local",
        "http://localhost:11434",
        1,
        new Date().toISOString(),
        "{}",
      );
    database
      .prepare(
        `INSERT INTO text_provider_models(id,provider_id,remote_id,name,enabled,details_json)
         VALUES(?,?,?,?,?,?)`,
      )
      .run("model-1", "provider-1", "model-1", "Model 1", 1, "{}");

    expect(() =>
      database
        .prepare(
          `INSERT INTO entity_generation_runs(id,kind,model_id,prompt,status)
           VALUES(?,?,?,?,?)`,
        )
        .run(
          "run-1",
          "scenario",
          "model-1",
          "изменить граф",
          "clarification_requested",
        ),
    ).not.toThrow();

    expect(() =>
      database
        .prepare(
          `INSERT INTO user_questions(id,scope,entity_generation_run_id,question)
           VALUES(?,?,?,?)`,
        )
        .run("question-1", "generation", "run-1", "Какой узел добавить?"),
    ).not.toThrow();

    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("добавляет устойчивый журнал диалога агент-узла сценария", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);

    database
      .prepare(`INSERT INTO automation_scenarios(id,name) VALUES(?,?)`)
      .run("scenario-1", "Тестовый сценарий");
    database
      .prepare(
        `INSERT INTO automation_scenario_revisions(id,scenario_id,version,graph_json)
         VALUES(?,?,?,?)`,
      )
      .run("revision-1", "scenario-1", 1, "{}");
    database
      .prepare(
        `INSERT INTO execution_runs(id,kind,origin,scenario_id,scenario_revision_id,status,input_json)
         VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        "exec-1",
        "scenario",
        "background",
        "scenario-1",
        "revision-1",
        "running",
        "{}",
      );

    expect(() =>
      database
        .prepare(
          `INSERT INTO scenario_agent_conversations(id,execution_id,node_id,active_model_id)
           VALUES(?,?,?,?)`,
        )
        .run("conv-1", "exec-1", "node-1", "model-1"),
    ).not.toThrow();

    expect(() =>
      database
        .prepare(
          `INSERT INTO scenario_agent_segments(
             id,conversation_id,from_message_id,to_message_id,summary,
             model_id,message_count,tokens_before,tokens_after,reason
           ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          "seg-1",
          "conv-1",
          "msg-1",
          "msg-2",
          "сводка",
          "model-1",
          2,
          100,
          20,
          "threshold",
        ),
    ).not.toThrow();

    expect(() =>
      database
        .prepare(
          `INSERT INTO scenario_agent_messages(id,conversation_id,step_index,role,parts_json,compacted_into)
           VALUES(?,?,?,?,?,?)`,
        )
        .run("msg-3", "conv-1", 0, "user", "[]", null),
    ).not.toThrow();

    expect(database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
