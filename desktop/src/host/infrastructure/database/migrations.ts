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

        CREATE TABLE automation_tool_secret_bindings (
          tool_id TEXT NOT NULL,
          binding_key TEXT NOT NULL,
          secret_id INTEGER NOT NULL,
          PRIMARY KEY (tool_id, binding_key),
          FOREIGN KEY (secret_id)
            REFERENCES secret_entities(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
        );

        CREATE TABLE automation_scenarios (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'draft'
            CHECK (status IN ('draft', 'active', 'disabled')),
          active_revision_id INTEGER,
          last_run_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE automation_scenario_revisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scenario_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          graph_json TEXT NOT NULL,
          tool_settings_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE (scenario_id, version),
          FOREIGN KEY (scenario_id)
            REFERENCES automation_scenarios(id)
            ON UPDATE CASCADE
            ON DELETE CASCADE
        );

        CREATE INDEX idx_automation_agents_status
          ON automation_agents(status);
        CREATE INDEX idx_automation_scenarios_status
          ON automation_scenarios(status);
        CREATE INDEX idx_automation_scenario_revisions_scenario
          ON automation_scenario_revisions(scenario_id, version DESC);
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
          mode TEXT NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat', 'planner', 'agent', 'scenario')),
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
          execution_run_id INTEGER,
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

        CREATE TABLE execution_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL CHECK (kind IN ('scenario')),
          origin TEXT NOT NULL CHECK (origin IN ('manual','chat','background')),
          scenario_id TEXT NOT NULL,
          scenario_revision_id INTEGER NOT NULL,
          conversation_id INTEGER,
          status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_approval','completed','failed','cancelled')),
          input_json TEXT NOT NULL DEFAULT '{}',
          output_json TEXT,
          error_message TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (scenario_id) REFERENCES automation_scenarios(id) ON DELETE CASCADE,
          FOREIGN KEY (scenario_revision_id) REFERENCES automation_scenario_revisions(id) ON DELETE RESTRICT,
          FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE SET NULL
        );

        CREATE TABLE scenario_node_runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          node_id TEXT NOT NULL,
          node_kind TEXT NOT NULL,
          attempt INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL CHECK (status IN ('queued','running','waiting_for_approval','completed','failed','cancelled')),
          input_json TEXT NOT NULL DEFAULT '{}',
          output_json TEXT,
          error_message TEXT,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(execution_id, node_id, attempt),
          FOREIGN KEY (execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_execution_runs_scenario ON execution_runs(scenario_id, id DESC);
        CREATE INDEX idx_scenario_node_runs_execution ON scenario_node_runs(execution_id, id);
      `);
    },
  },
  {
    version: 7,
    up(database) {
      database.exec(`
        ALTER TABLE text_provider_configs
          ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'text'
          CHECK (provider_type IN ('text', 'embedding'));

        CREATE INDEX idx_text_provider_configs_type
          ON text_provider_configs(provider_type, enabled);
      `);
    },
  },
  {
    version: 8,
    up(database) {
      database.exec(`
        CREATE TABLE vector_stores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          embedding_model_id INTEGER,
          status TEXT NOT NULL DEFAULT 'disabled' CHECK(status IN ('ready','indexing','degraded','disabled')),
          search_mode TEXT NOT NULL DEFAULT 'vector' CHECK(search_mode IN ('vector','hybrid')),
          chunk_size_tokens INTEGER NOT NULL DEFAULT 700 CHECK(chunk_size_tokens BETWEEN 100 AND 4096),
          chunk_overlap_tokens INTEGER NOT NULL DEFAULT 100 CHECK(chunk_overlap_tokens >= 0 AND chunk_overlap_tokens <= chunk_size_tokens / 2),
          vector_dimension INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(embedding_model_id) REFERENCES text_provider_models(id) ON DELETE SET NULL
        );
        CREATE TABLE vector_store_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          vector_store_id INTEGER NOT NULL,
          file_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          local_path TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          size INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','extracting','embedding','ready','failed')),
          progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
          chunk_count INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(vector_store_id, content_hash),
          FOREIGN KEY(vector_store_id) REFERENCES vector_stores(id) ON DELETE CASCADE
        );
        CREATE TABLE automation_agent_vector_stores (
          agent_id TEXT NOT NULL,
          vector_store_id INTEGER NOT NULL,
          PRIMARY KEY(agent_id, vector_store_id),
          FOREIGN KEY(agent_id) REFERENCES automation_agents(id) ON DELETE CASCADE,
          FOREIGN KEY(vector_store_id) REFERENCES vector_stores(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_vector_store_documents_store ON vector_store_documents(vector_store_id, status);
        ALTER TABLE automation_agents ADD COLUMN retrieval_limit INTEGER NOT NULL DEFAULT 5 CHECK(retrieval_limit BETWEEN 1 AND 20);
      `);
    },
  },
  {
    version: 9,
    up(database) {
      database.exec(`
        CREATE TABLE automation_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','disabled')),
          version TEXT NOT NULL DEFAULT '1.0.0',
          author TEXT NOT NULL DEFAULT '',
          builtin INTEGER NOT NULL DEFAULT 0 CHECK(builtin IN (0,1)),
          required_tool_ids_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE automation_agent_skills (
          agent_id TEXT NOT NULL,
          skill_id INTEGER NOT NULL,
          PRIMARY KEY(agent_id, skill_id),
          FOREIGN KEY(agent_id) REFERENCES automation_agents(id) ON DELETE CASCADE,
          FOREIGN KEY(skill_id) REFERENCES automation_skills(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_automation_skills_status ON automation_skills(status, updated_at);
      `);
    },
  },
  {
    version: 10,
    up(database) {
      database.exec(`
        ALTER TABLE text_provider_configs
          ADD COLUMN limits_json TEXT;
      `);
    },
  },
  {
    version: 11,
    up(database) {
      database.exec(`
        ALTER TABLE text_provider_configs
          ADD COLUMN generation_settings_json TEXT NOT NULL
          DEFAULT '{"maxOutputTokens":2048,"temperature":0.7,"topP":0.9}';
      `);
    },
  },
  {
    version: 12,
    up(database) {
      database.exec(`
        ALTER TABLE automation_agents
          ADD COLUMN terminal_policy_json TEXT NOT NULL
          DEFAULT '{"enabled":false,"confirmationMode":"always","timeoutSeconds":60,"allowedCommands":[]}';

        ALTER TABLE automation_agents
          ADD COLUMN directory_policy_json TEXT NOT NULL
          DEFAULT '{"grants":[]}';

        CREATE TABLE terminal_policy (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
          confirmation_mode TEXT NOT NULL DEFAULT 'always'
            CHECK(confirmation_mode IN ('always','risky','policy')),
          max_concurrent_sessions INTEGER NOT NULL DEFAULT 2
            CHECK(max_concurrent_sessions BETWEEN 1 AND 16),
          default_timeout_seconds INTEGER NOT NULL DEFAULT 60
            CHECK(default_timeout_seconds BETWEEN 1 AND 3600),
          max_timeout_seconds INTEGER NOT NULL DEFAULT 300
            CHECK(max_timeout_seconds BETWEEN 1 AND 86400),
          max_output_bytes INTEGER NOT NULL DEFAULT 1048576
            CHECK(max_output_bytes BETWEEN 4096 AND 16777216),
          allow_network INTEGER NOT NULL DEFAULT 0 CHECK(allow_network IN (0,1)),
          allowed_commands_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO terminal_policy(id) VALUES(1);

        CREATE TABLE directory_policy (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          grants_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO directory_policy(id) VALUES(1);

        CREATE TABLE command_sessions (
          id TEXT PRIMARY KEY,
          agent_id TEXT,
          chat_run_id INTEGER,
          scenario_run_id INTEGER,
          tool_call_id TEXT,
          purpose TEXT NOT NULL,
          script TEXT NOT NULL,
          cwd TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN (
            'pending_approval','queued','running','completed','failed',
            'cancelled','timed_out'
          )),
          policy_snapshot_json TEXT NOT NULL,
          risk TEXT NOT NULL CHECK(risk IN ('low','medium','high','critical')),
          decision_reasons_json TEXT NOT NULL DEFAULT '[]',
          exit_code INTEGER,
          stdout_text TEXT NOT NULL DEFAULT '',
          stderr_text TEXT NOT NULL DEFAULT '',
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          started_at TEXT,
          completed_at TEXT,
          FOREIGN KEY(agent_id) REFERENCES automation_agents(id) ON DELETE SET NULL
        );
        CREATE INDEX idx_command_sessions_status ON command_sessions(status, created_at);

        CREATE TABLE command_approval_requests (
          id TEXT PRIMARY KEY,
          command_session_id TEXT NOT NULL UNIQUE,
          payload_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','approved','rejected','expired')),
          expires_at TEXT NOT NULL,
          decided_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(command_session_id) REFERENCES command_sessions(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_command_approvals_status
          ON command_approval_requests(status, expires_at);
      `);
    },
  },
  {
    version: 13,
    up(database) {
      database.exec(`
        CREATE TABLE integration_profiles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL CHECK(kind IN ('telegram_bot','email_imap', 'github_connector', 'gitlab_connector')),
          name TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
          config_json TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'unchecked'
            CHECK(status IN ('unchecked','connected','error','disabled')),
          checked_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE integration_secret_bindings (
          profile_id INTEGER NOT NULL,
          binding_key TEXT NOT NULL,
          secret_id INTEGER NOT NULL,
          PRIMARY KEY(profile_id, binding_key),
          FOREIGN KEY(profile_id) REFERENCES integration_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY(secret_id) REFERENCES secret_entities(id) ON DELETE RESTRICT
        );

        CREATE TABLE scenario_trigger_bindings (
          id TEXT PRIMARY KEY,
          scenario_id TEXT NOT NULL,
          scenario_revision_id INTEGER NOT NULL,
          trigger_node_id TEXT NOT NULL,
          kind TEXT NOT NULL CHECK(kind IN (
            'manual_chat','manual_editor','telegram','email','interval'
          )),
          integration_profile_id INTEGER,
          enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
          config_json TEXT NOT NULL DEFAULT '{}',
          next_run_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(scenario_id) REFERENCES automation_scenarios(id) ON DELETE CASCADE,
          FOREIGN KEY(scenario_revision_id) REFERENCES automation_scenario_revisions(id) ON DELETE CASCADE,
          FOREIGN KEY(integration_profile_id) REFERENCES integration_profiles(id) ON DELETE RESTRICT
        );
        CREATE INDEX idx_trigger_bindings_due
          ON scenario_trigger_bindings(kind, enabled, next_run_at);
        CREATE INDEX idx_trigger_bindings_scenario
          ON scenario_trigger_bindings(scenario_id, scenario_revision_id);

        CREATE TABLE trigger_cursors (
          binding_id TEXT PRIMARY KEY,
          cursor_json TEXT NOT NULL DEFAULT '{}',
          polled_at TEXT,
          last_event_at TEXT,
          last_error TEXT,
          FOREIGN KEY(binding_id) REFERENCES scenario_trigger_bindings(id) ON DELETE CASCADE
        );

        CREATE TABLE automation_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL CHECK(kind='scenario_run'),
          deduplication_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN (
            'queued','leased','waiting','completed','failed','cancelled'
          )),
          payload_json TEXT NOT NULL,
          available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          lease_owner TEXT,
          lease_expires_at TEXT,
          attempt INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          priority INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_automation_jobs_ready
          ON automation_jobs(status, available_at, priority DESC, id);

        CREATE TABLE execution_approvals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          node_run_id INTEGER NOT NULL,
          node_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','approved','denied','expired')),
          prompt TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          resolved_at TEXT,
          FOREIGN KEY(execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(node_run_id) REFERENCES scenario_node_runs(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_execution_approvals_pending
          ON execution_approvals(status, execution_id);
      `);
    },
  },
  {
    version: 14,
    up(database) {
      database.exec(`
        ALTER TABLE integration_profiles
          ADD COLUMN connection_metadata_json TEXT NOT NULL DEFAULT '{}';
      `);
    },
  },
  {
    version: 15,
    up(database) {
      database.exec(`
        CREATE TABLE scenario_file_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          node_run_id INTEGER NOT NULL,
          node_id TEXT NOT NULL,
          source_kind TEXT NOT NULL,
          source_external_id TEXT NOT NULL,
          integration_profile_id INTEGER,
          source_scope TEXT NOT NULL,
          input_json TEXT NOT NULL,
          cleanup_on_finish INTEGER NOT NULL DEFAULT 1 CHECK(cleanup_on_finish IN (0,1)),
          status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN (
            'queued','leased','completed','failed','cancelled'
          )),
          lease_owner TEXT,
          lease_expires_at TEXT,
          attempt INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(execution_id,node_id,source_kind,source_scope,source_external_id),
          FOREIGN KEY(execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(node_run_id) REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(integration_profile_id) REFERENCES integration_profiles(id) ON DELETE RESTRICT
        );
        CREATE INDEX idx_scenario_file_jobs_ready
          ON scenario_file_jobs(status, id);

        CREATE TABLE execution_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          node_run_id INTEGER NOT NULL,
          job_id INTEGER NOT NULL UNIQUE,
          source_kind TEXT NOT NULL,
          source_external_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          mime_type TEXT,
          size INTEGER NOT NULL CHECK(size >= 0),
          sha256 TEXT NOT NULL,
          storage_key TEXT NOT NULL UNIQUE,
          local_path TEXT NOT NULL,
          deleted_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(node_run_id) REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(job_id) REFERENCES scenario_file_jobs(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_execution_files_run
          ON execution_files(execution_id,node_run_id);
      `);
    },
  },
  {
    version: 16,
    up(database) {
      database.exec(`
        CREATE TABLE scenario_delivery_outbox (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          node_run_id INTEGER NOT NULL,
          channel TEXT NOT NULL CHECK(channel IN ('telegram','email')),
          integration_profile_id INTEGER NOT NULL,
          recipient TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','completed','failed')),
          attempt INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 5,
          available_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          lease_owner TEXT,
          lease_expires_at TEXT,
          last_error TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT,
          FOREIGN KEY(execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(node_run_id) REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(integration_profile_id) REFERENCES integration_profiles(id) ON DELETE RESTRICT
        );
        CREATE INDEX idx_scenario_delivery_ready
          ON scenario_delivery_outbox(status,available_at,id);
      `);
    },
  },
  {
    version: 17,
    up: (database) => {
      database.exec(`
        CREATE TABLE memory_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL DEFAULT 'fact'
            CHECK(kind IN ('fact','preference','instruction','episode')),
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          tags_json TEXT NOT NULL DEFAULT '[]',
          source TEXT NOT NULL DEFAULT 'chat'
            CHECK(source IN ('chat','scenario','manual')),
          conversation_id INTEGER,
          execution_id INTEGER,
          agent_id TEXT,
          pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
          hits INTEGER NOT NULL DEFAULT 0 CHECK(hits >= 0),
          used_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE SET NULL,
          FOREIGN KEY(execution_id) REFERENCES execution_runs(id) ON DELETE SET NULL
        );
        CREATE INDEX idx_memory_entries_lookup ON memory_entries(pinned DESC, updated_at DESC);
        CREATE UNIQUE INDEX idx_memory_entries_title ON memory_entries(title);

        CREATE VIRTUAL TABLE memory_search USING fts5(
          title, content, tags,
          content='memory_entries', content_rowid='id',
          tokenize='unicode61 remove_diacritics 2'
        );
        CREATE TRIGGER memory_entries_ai AFTER INSERT ON memory_entries BEGIN
          INSERT INTO memory_search(rowid,title,content,tags)
          VALUES (new.id,new.title,new.content,new.tags_json);
        END;
        CREATE TRIGGER memory_entries_ad AFTER DELETE ON memory_entries BEGIN
          INSERT INTO memory_search(memory_search,rowid,title,content,tags)
          VALUES ('delete',old.id,old.title,old.content,old.tags_json);
        END;
        CREATE TRIGGER memory_entries_au AFTER UPDATE ON memory_entries BEGIN
          INSERT INTO memory_search(memory_search,rowid,title,content,tags)
          VALUES ('delete',old.id,old.title,old.content,old.tags_json);
          INSERT INTO memory_search(rowid,title,content,tags)
          VALUES (new.id,new.title,new.content,new.tags_json);
        END;

        CREATE TABLE memory_policy (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
          autosave INTEGER NOT NULL DEFAULT 1 CHECK(autosave IN (0,1)),
          allow_scenario_writes INTEGER NOT NULL DEFAULT 0 CHECK(allow_scenario_writes IN (0,1)),
          max_entries INTEGER NOT NULL DEFAULT 500 CHECK(max_entries > 0),
          max_content_chars INTEGER NOT NULL DEFAULT 2000 CHECK(max_content_chars > 0),
          injected_entries INTEGER NOT NULL DEFAULT 12 CHECK(injected_entries >= 0),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO memory_policy(id) VALUES(1);

        ALTER TABLE automation_agents ADD COLUMN memory_read INTEGER NOT NULL DEFAULT 0 CHECK(memory_read IN (0,1));
        ALTER TABLE automation_agents ADD COLUMN memory_write INTEGER NOT NULL DEFAULT 0 CHECK(memory_write IN (0,1));

        CREATE TABLE task_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER,
          execution_id INTEGER,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
          FOREIGN KEY(execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE
        );
        CREATE UNIQUE INDEX idx_task_plans_conversation ON task_plans(conversation_id) WHERE conversation_id IS NOT NULL;
        CREATE UNIQUE INDEX idx_task_plans_execution ON task_plans(execution_id) WHERE execution_id IS NOT NULL;

        CREATE TABLE task_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id INTEGER NOT NULL,
          position INTEGER NOT NULL,
          subject TEXT NOT NULL,
          detail TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','in_progress','completed','skipped')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(plan_id) REFERENCES task_plans(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_task_items_plan ON task_items(plan_id, position);

        CREATE TABLE user_questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope TEXT NOT NULL CHECK(scope IN ('chat','scenario')),
          conversation_id INTEGER,
          run_id INTEGER,
          execution_id INTEGER,
          node_id TEXT,
          node_run_id INTEGER,
          mode TEXT NOT NULL DEFAULT 'choice'
            CHECK(mode IN ('confirm','choice','text')),
          header TEXT NOT NULL DEFAULT '',
          question TEXT NOT NULL,
          options_json TEXT NOT NULL DEFAULT '[]',
          multi_select INTEGER NOT NULL DEFAULT 0 CHECK(multi_select IN (0,1)),
          default_answer TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','answered','timed_out','cancelled')),
          answer_json TEXT,
          answered_by TEXT,
          answered_via TEXT
            CHECK(answered_via IN ('ui','telegram','email','default')),
          channel TEXT NOT NULL DEFAULT 'ui'
            CHECK(channel IN ('ui','telegram','email')),
          integration_profile_id INTEGER,
          recipient TEXT,
          correlation_id TEXT,
          expected_author TEXT,
          expires_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          answered_at TEXT,
          FOREIGN KEY(conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
          FOREIGN KEY(execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE,
          FOREIGN KEY(integration_profile_id) REFERENCES integration_profiles(id) ON DELETE SET NULL
        );
        CREATE INDEX idx_user_questions_pending ON user_questions(status, expires_at);
        CREATE INDEX idx_user_questions_execution ON user_questions(execution_id, node_id);
        CREATE INDEX idx_user_questions_correlation ON user_questions(channel, correlation_id) WHERE status='pending';
        CREATE INDEX idx_user_questions_conversation ON user_questions(conversation_id, status);
      `);
    },
  },
  {
    version: 18,
    up(database) {
      database.exec(`
        PRAGMA foreign_keys = OFF;

        ALTER TABLE execution_runs ADD COLUMN checkpoint_json TEXT;
        ALTER TABLE execution_runs ADD COLUMN engine_version INTEGER NOT NULL DEFAULT 1;

        CREATE TABLE scenario_node_runs_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          node_id TEXT NOT NULL,
          node_kind TEXT NOT NULL,
          iteration INTEGER NOT NULL DEFAULT 1,
          attempt INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL CHECK (status IN (
            'queued','running','waiting_for_approval','completed','failed','cancelled','skipped'
          )),
          input_json TEXT NOT NULL DEFAULT '{}',
          input_ref TEXT,
          output_json TEXT,
          output_ref TEXT,
          diagnostics_json TEXT,
          error_message TEXT,
          error_code TEXT,
          partial_output TEXT,
          duration_ms INTEGER,
          started_at TEXT,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(execution_id, node_id, iteration, attempt),
          FOREIGN KEY (execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE
        );

        INSERT INTO scenario_node_runs_new (
          id, execution_id, node_id, node_kind, iteration, attempt, status,
          input_json, output_json, error_message, started_at, completed_at, created_at
        )
        SELECT
          id, execution_id, node_id, node_kind, 1, attempt, status,
          input_json, output_json, error_message, started_at, completed_at, created_at
        FROM scenario_node_runs;

        DROP TABLE scenario_node_runs;
        ALTER TABLE scenario_node_runs_new RENAME TO scenario_node_runs;

        CREATE INDEX idx_scenario_node_runs_execution ON scenario_node_runs(execution_id, id);

        CREATE TABLE llm_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          execution_id INTEGER NOT NULL,
          node_run_id INTEGER NOT NULL,
          model_id INTEGER,
          system_prompt TEXT,
          prompt_json TEXT,
          output_text TEXT,
          prompt_tokens INTEGER,
          completion_tokens INTEGER,
          latency_ms INTEGER,
          finish_reason TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (execution_id) REFERENCES execution_runs(id) ON DELETE CASCADE,
          FOREIGN KEY (node_run_id) REFERENCES scenario_node_runs(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_llm_calls_execution ON llm_calls(execution_id, id);
        CREATE INDEX idx_llm_calls_node_run ON llm_calls(node_run_id);

        PRAGMA foreign_keys = ON;
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
