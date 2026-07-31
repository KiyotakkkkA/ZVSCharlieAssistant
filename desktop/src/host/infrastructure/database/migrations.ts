import type Database from "better-sqlite3";

interface Migration {
  version: number;
  up: (database: Database.Database) => void;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    up(database) {
      database.exec(`
        CREATE TABLE secret_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          label TEXT NOT NULL COLLATE NOCASE UNIQUE,
          builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0, 1))
        );

        CREATE TABLE secret_entities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          label TEXT NOT NULL,
          content TEXT NOT NULL,
          builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0, 1)),
          FOREIGN KEY (category_id)
            REFERENCES secret_categories(id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT
        );

        CREATE INDEX idx_secret_entities_category_id
          ON secret_entities(category_id);
      `);
    },
  },
  {
    version: 2,
    up(database) {
      database.exec(`
        INSERT INTO secret_categories (label, builtin) VALUES
          ('Ключи API', 1),
          ('Личные данные', 1);
      `);
    },
  },
  {
    version: 3,
    up(database) {
      database.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE secret_entities_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        content TEXT NOT NULL,
        builtin INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0, 1)),
        FOREIGN KEY (category_id)
          REFERENCES secret_categories(id)
          ON UPDATE CASCADE
          ON DELETE CASCADE
      );

      INSERT INTO secret_entities_new (
        id,
        category_id,
        label,
        content,
        builtin
      )
      SELECT
        id,
        category_id,
        label,
        content,
        builtin
      FROM secret_entities;

      DROP TABLE secret_entities;
      ALTER TABLE secret_entities_new RENAME TO secret_entities;

      CREATE INDEX idx_secret_entities_category_id
        ON secret_entities(category_id);

      PRAGMA foreign_keys = ON;
    `);
    },
  },
  {
    version: 4,
    up(database) {
      database.exec(`
        CREATE TABLE automation_agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          instructions TEXT NOT NULL,
          model TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'active', 'disabled')),
          require_dangerous_action_confirmation INTEGER NOT NULL DEFAULT 1
            CHECK (require_dangerous_action_confirmation IN (0, 1)),
          max_tool_calls INTEGER NOT NULL DEFAULT 20 CHECK (max_tool_calls > 0),
          timeout_seconds INTEGER NOT NULL DEFAULT 120 CHECK (timeout_seconds > 0),
          runs INTEGER NOT NULL DEFAULT 0 CHECK (runs >= 0),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE automation_agent_tools (
          agent_id TEXT NOT NULL,
          tool_id TEXT NOT NULL,
          PRIMARY KEY (agent_id, tool_id),
          FOREIGN KEY (agent_id)
            REFERENCES automation_agents(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
        );

        CREATE TABLE automation_agent_secrets (
          agent_id TEXT NOT NULL,
          secret_id INTEGER NOT NULL,
          PRIMARY KEY (agent_id, secret_id),
          FOREIGN KEY (agent_id)
            REFERENCES automation_agents(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE,
          FOREIGN KEY (secret_id)
            REFERENCES secret_entities(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
        );

        CREATE TABLE automation_agent_secret_tools (
          agent_id TEXT NOT NULL,
          secret_id INTEGER NOT NULL,
          tool_id TEXT NOT NULL,
          PRIMARY KEY (agent_id, secret_id, tool_id),
          FOREIGN KEY (agent_id, secret_id)
            REFERENCES automation_agent_secrets(agent_id, secret_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
        );

        CREATE TABLE automation_scenarios (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'active', 'disabled')),
          graph_json TEXT NOT NULL,
          last_run_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE automation_scenario_tool_settings (
          scenario_id TEXT NOT NULL,
          tool_id TEXT NOT NULL,
          settings_json TEXT NOT NULL DEFAULT '{}',
          PRIMARY KEY (scenario_id, tool_id),
          FOREIGN KEY (scenario_id)
            REFERENCES automation_scenarios(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
        );

        CREATE INDEX idx_automation_agents_status
          ON automation_agents(status);
        CREATE INDEX idx_automation_scenarios_status
          ON automation_scenarios(status);
      `);
    },
  },
];

export function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedVersions = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const applyMigration = database.transaction((migration: Migration) => {
    migration.up(database);
    database
      .prepare("INSERT INTO schema_migrations (version) VALUES (?)")
      .run(migration.version);
  });

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) applyMigration(migration);
  }
}
