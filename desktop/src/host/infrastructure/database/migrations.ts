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
          text_model_id INTEGER,
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'active', 'disabled')),
          require_dangerous_action_confirmation INTEGER NOT NULL DEFAULT 1
            CHECK (require_dangerous_action_confirmation IN (0, 1)),
          max_tool_calls INTEGER NOT NULL DEFAULT 20 CHECK (max_tool_calls > 0),
          timeout_seconds INTEGER NOT NULL DEFAULT 120 CHECK (timeout_seconds > 0),
          runs INTEGER NOT NULL DEFAULT 0 CHECK (runs >= 0),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          ,FOREIGN KEY (text_model_id) REFERENCES text_provider_models(id) ON UPDATE CASCADE ON DELETE SET NULL
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
  {
    version: 5,
    up(database) {
      database.exec(`
        CREATE TABLE text_provider_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          api_key_secret_id INTEGER,
          enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
          checked_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (api_key_secret_id) REFERENCES secret_entities(id)
            ON UPDATE CASCADE ON DELETE SET NULL
        );

        CREATE TABLE text_provider_models (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_id INTEGER NOT NULL,
          remote_id TEXT NOT NULL,
          name TEXT NOT NULL,
          modified_at TEXT NOT NULL DEFAULT '',
          size INTEGER NOT NULL DEFAULT 0,
          digest TEXT NOT NULL DEFAULT '',
          details_json TEXT NOT NULL DEFAULT '{}',
          enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
          UNIQUE (provider_id, remote_id),
          FOREIGN KEY (provider_id) REFERENCES text_provider_configs(id)
            ON UPDATE CASCADE ON DELETE CASCADE
        );

        CREATE INDEX idx_text_provider_models_enabled
          ON text_provider_models(provider_id, enabled);
      `);
    },
  },
  {
    version: 6,
    up(database) {
      database.exec(`
        CREATE TABLE chat_conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL DEFAULT 'Новый диалог',
          mode TEXT NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat', 'planner', 'agent')),
          agent_id TEXT,
          model_id INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agent_id) REFERENCES automation_agents(id) ON DELETE SET NULL,
          FOREIGN KEY (model_id) REFERENCES text_provider_models(id) ON DELETE SET NULL
        );
        CREATE TABLE generation_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          agent_id TEXT,
          model_id INTEGER NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_approval','completed','failed','cancelled')),
          current_step INTEGER NOT NULL DEFAULT 0,
          max_steps INTEGER NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          error_code TEXT,
          error_message TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (agent_id) REFERENCES automation_agents(id) ON DELETE SET NULL,
          FOREIGN KEY (model_id) REFERENCES text_provider_models(id) ON DELETE RESTRICT
        );
        CREATE TABLE chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          run_id INTEGER,
          role TEXT NOT NULL CHECK (role IN ('system','user','assistant','tool')),
          status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('streaming','completed','failed','cancelled')),
          content_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (run_id) REFERENCES generation_runs(id) ON DELETE SET NULL
        );
        CREATE TABLE chat_attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          message_id INTEGER,
          name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          local_path TEXT NOT NULL,
          size INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
        );
        CREATE TABLE generation_run_steps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          step_index INTEGER NOT NULL,
          finish_reason TEXT,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(run_id, step_index),
          FOREIGN KEY (run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
        );
        CREATE TABLE generation_tool_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id INTEGER NOT NULL,
          provider_call_id TEXT NOT NULL,
          tool_id TEXT NOT NULL,
          risk TEXT NOT NULL CHECK (risk IN ('read','write','destructive')),
          status TEXT NOT NULL CHECK (status IN ('requested','waiting_for_approval','running','completed','failed','denied')),
          input_json TEXT NOT NULL,
          output_json TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT,
          UNIQUE(run_id, provider_call_id),
          FOREIGN KEY (run_id) REFERENCES generation_runs(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, id);
        CREATE INDEX idx_generation_runs_conversation ON generation_runs(conversation_id, id);
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
