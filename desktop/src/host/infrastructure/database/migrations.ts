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
  {
    version: 5,
    name: "raise-legacy-output-limit",
    sql: `
      UPDATE text_provider_configs
      SET generation_settings_json = json_set(
        generation_settings_json,
        '$.maxOutputTokens',
        8192
      )
      WHERE json_extract(
        generation_settings_json,
        '$.maxOutputTokens'
      ) = 2048;
    `,
  },
  {
    version: 6,
    name: "project-compact-model",
    sql: `
      ALTER TABLE projects ADD COLUMN compact_model_id TEXT
        REFERENCES text_provider_models(id) ON DELETE SET NULL;
    `,
  },
  {
    version: 7,
    name: "generation-ask-user",
    sql: `
      ALTER TABLE entity_generation_runs RENAME TO entity_generation_runs_old;
      CREATE TABLE entity_generation_runs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK(kind IN ('agent','skill','scenario')),
        model_id TEXT NOT NULL REFERENCES text_provider_models(id) ON DELETE RESTRICT,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','clarification_requested','completed','failed','cancelled')),
        entity_id TEXT,
        entity_name TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at TEXT,
        completed_at TEXT
      );
      INSERT INTO entity_generation_runs
        SELECT id,kind,model_id,prompt,status,entity_id,entity_name,error_message,created_at,started_at,completed_at
        FROM entity_generation_runs_old;
      DROP TABLE entity_generation_runs_old;
      CREATE INDEX idx_entity_generation_runs_created_at ON entity_generation_runs(created_at DESC);

      ALTER TABLE user_questions RENAME TO user_questions_old;
      CREATE TABLE user_questions (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK(scope IN ('chat','scenario','generation')),
        conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES generation_runs(id) ON DELETE CASCADE,
        entity_generation_run_id TEXT REFERENCES entity_generation_runs(id) ON DELETE CASCADE,
        execution_id TEXT REFERENCES execution_runs(id) ON DELETE CASCADE,
        node_id TEXT,
        node_run_id TEXT REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
        mode TEXT NOT NULL DEFAULT 'choice' CHECK(mode IN ('confirm','choice','text')),
        header TEXT NOT NULL DEFAULT '',
        question TEXT NOT NULL,
        options_json TEXT NOT NULL DEFAULT '[]',
        multi_select INTEGER NOT NULL DEFAULT 0 CHECK(multi_select IN (0,1)),
        default_answer TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','answered','timed_out','cancelled')),
        answer_json TEXT,
        answered_by TEXT,
        answered_via TEXT CHECK(answered_via IN ('ui','telegram','email','default')),
        channel TEXT NOT NULL DEFAULT 'ui' CHECK(channel IN ('ui','telegram','email')),
        integration_profile_id TEXT REFERENCES integration_profiles(id) ON DELETE SET NULL,
        recipient TEXT,
        correlation_id TEXT,
        expected_author TEXT,
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        answered_at TEXT
      );
      INSERT INTO user_questions
        SELECT id,scope,conversation_id,run_id,NULL,execution_id,node_id,node_run_id,mode,
               header,question,options_json,multi_select,default_answer,status,answer_json,
               answered_by,answered_via,channel,integration_profile_id,recipient,correlation_id,
               expected_author,expires_at,created_at,answered_at
        FROM user_questions_old;
      DROP TABLE user_questions_old;
      CREATE INDEX idx_user_questions_pending ON user_questions(status,expires_at);
      CREATE INDEX idx_user_questions_execution ON user_questions(execution_id,node_id);
      CREATE INDEX idx_user_questions_correlation ON user_questions(channel,correlation_id) WHERE status='pending';
      CREATE INDEX idx_user_questions_conversation ON user_questions(conversation_id,status);
      CREATE INDEX idx_user_questions_generation ON user_questions(entity_generation_run_id,status);
    `,
  },
  {
    version: 8,
    name: "scenario-agent-durability",
    sql: `
      CREATE TABLE scenario_agent_conversations (
        id TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','failed')),
        active_model_id TEXT NOT NULL,
        next_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(execution_id, node_id)
      );
      CREATE TABLE scenario_agent_segments (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES scenario_agent_conversations(id) ON DELETE CASCADE,
        from_message_id TEXT NOT NULL,
        to_message_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        model_id TEXT NOT NULL,
        message_count INTEGER NOT NULL,
        tokens_before INTEGER NOT NULL,
        tokens_after INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE scenario_agent_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES scenario_agent_conversations(id) ON DELETE CASCADE,
        step_index INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user','assistant')),
        parts_json TEXT NOT NULL,
        compacted_into TEXT REFERENCES scenario_agent_segments(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_scenario_agent_messages_conv ON scenario_agent_messages(conversation_id, step_index);
    `,
  },
  {
    version: 9,
    name: "report-builder-session-durability",
    sql: `
      CREATE TABLE report_builder_sessions (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        template TEXT NOT NULL,
        title TEXT,
        blocks_json TEXT NOT NULL DEFAULT '[]',
        next_sequence INTEGER NOT NULL DEFAULT 0,
        bytes_received INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        touched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_report_builder_sessions_touched ON report_builder_sessions(touched_at);
    `,
  },
  {
    version: 10,
    name: "allow-builtin-embedding-model",
    sql: `
      CREATE TABLE vector_stores_rebuilt (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        embedding_model_id TEXT,
        status TEXT NOT NULL DEFAULT 'disabled' CHECK(status IN ('ready','indexing','degraded','disabled')),
        search_mode TEXT NOT NULL DEFAULT 'vector' CHECK(search_mode IN ('vector','hybrid')),
        chunk_size_tokens INTEGER NOT NULL DEFAULT 700 CHECK(chunk_size_tokens BETWEEN 100 AND 4096),
        chunk_overlap_tokens INTEGER NOT NULL DEFAULT 100 CHECK(chunk_overlap_tokens >= 0 AND chunk_overlap_tokens <= chunk_size_tokens / 2),
        vector_dimension INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO vector_stores_rebuilt
        SELECT id, name, description, embedding_model_id, status, search_mode,
               chunk_size_tokens, chunk_overlap_tokens, vector_dimension,
               created_at, updated_at
        FROM vector_stores;
      DROP TABLE vector_stores;
      ALTER TABLE vector_stores_rebuilt RENAME TO vector_stores;
    `,
  },
  {
    version: 11,
    name: "scenario-effect-log",
    sql: `
      CREATE TABLE scenario_effects (
        idempotency_key TEXT PRIMARY KEY,
        execution_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_scenario_effects_execution ON scenario_effects(execution_id);
    `,
  },
  {
    version: 12,
    name: "vector-document-needs-review",
    sql: `
      CREATE TABLE vector_store_documents_rebuilt (
        id TEXT PRIMARY KEY,
        vector_store_id TEXT NOT NULL REFERENCES vector_stores(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        local_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        size INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','extracting','embedding','ready','needs_review','failed')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
        chunk_count INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(vector_store_id,content_hash)
      );
      INSERT INTO vector_store_documents_rebuilt
        SELECT id, vector_store_id, file_name, mime_type, local_path, content_hash,
               size, status, progress, chunk_count, error_message, created_at
        FROM vector_store_documents;
      DROP TABLE vector_store_documents;
      ALTER TABLE vector_store_documents_rebuilt RENAME TO vector_store_documents;
      CREATE INDEX idx_vector_store_documents_store ON vector_store_documents(vector_store_id,status);
    `,
  },
  {
    version: 13,
    name: "text-provider-model-availability",
    sql: `
      ALTER TABLE text_provider_models
        ADD COLUMN available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1));
      CREATE INDEX idx_text_provider_models_available ON text_provider_models(provider_id,available);
    `,
  },
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
