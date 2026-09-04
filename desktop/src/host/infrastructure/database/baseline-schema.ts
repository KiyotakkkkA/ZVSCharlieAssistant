export const SCHEMA_GENERATION = "uuid-v7-v1";

export const BASELINE_SCHEMA_SQL = `
CREATE TABLE schema_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO schema_metadata(key,value) VALUES('schema_generation','${SCHEMA_GENERATION}');

CREATE TABLE secret_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL COLLATE NOCASE UNIQUE,
  builtin INTEGER NOT NULL DEFAULT 0 CHECK(builtin IN (0,1)),
  system_key TEXT UNIQUE
);
CREATE TABLE secret_entities (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES secret_categories(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0 CHECK(builtin IN (0,1))
);
CREATE INDEX idx_secret_entities_category_id ON secret_entities(category_id);
INSERT INTO secret_categories(id,label,builtin,system_key) VALUES
  ('00000000-0000-7000-8000-000000000001','Ключи API',1,'api-keys'),
  ('00000000-0000-7000-8000-000000000002','Личные данные',1,'personal-data');

CREATE TABLE text_provider_configs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key_secret_id TEXT REFERENCES secret_entities(id) ON UPDATE CASCADE ON DELETE SET NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  checked_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider_type TEXT NOT NULL DEFAULT 'text' CHECK(provider_type IN ('text','embedding')),
  limits_json TEXT,
  generation_settings_json TEXT NOT NULL DEFAULT '{"maxOutputTokens":8192,"temperature":0.7,"topP":0.9}'
);
CREATE INDEX idx_text_provider_configs_type ON text_provider_configs(provider_type,enabled);
CREATE TABLE text_provider_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES text_provider_configs(id) ON UPDATE CASCADE ON DELETE CASCADE,
  remote_id TEXT NOT NULL,
  name TEXT NOT NULL,
  modified_at TEXT NOT NULL DEFAULT '',
  size INTEGER NOT NULL DEFAULT 0,
  digest TEXT NOT NULL DEFAULT '',
  details_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  UNIQUE(provider_id,remote_id)
);
CREATE INDEX idx_text_provider_models_enabled ON text_provider_models(provider_id,enabled);

CREATE TABLE automation_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL,
  text_model_id TEXT REFERENCES text_provider_models(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','disabled')),
  max_tool_calls INTEGER NOT NULL DEFAULT 20 CHECK(max_tool_calls > 0),
  timeout_seconds INTEGER NOT NULL DEFAULT 120 CHECK(timeout_seconds > 0),
  runs INTEGER NOT NULL DEFAULT 0 CHECK(runs >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retrieval_limit INTEGER NOT NULL DEFAULT 5 CHECK(retrieval_limit BETWEEN 1 AND 20),
  terminal_policy_json TEXT NOT NULL DEFAULT '{"enabled":false,"confirmationMode":"always","timeoutSeconds":60,"allowedCommands":[]}',
  directory_policy_json TEXT NOT NULL DEFAULT '{"grants":[]}',
  memory_read INTEGER NOT NULL DEFAULT 0 CHECK(memory_read IN (0,1)),
  memory_write INTEGER NOT NULL DEFAULT 0 CHECK(memory_write IN (0,1))
);
CREATE INDEX idx_automation_agents_status ON automation_agents(status);
CREATE TABLE automation_agent_tools (
  agent_id TEXT NOT NULL REFERENCES automation_agents(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  PRIMARY KEY(agent_id,tool_id)
);
CREATE TABLE automation_tool_secret_bindings (
  tool_id TEXT NOT NULL,
  binding_key TEXT NOT NULL,
  secret_id TEXT NOT NULL REFERENCES secret_entities(id) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY(tool_id,binding_key)
);
CREATE TABLE automation_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','disabled')),
  active_revision_id TEXT REFERENCES automation_scenario_revisions(id) ON DELETE SET NULL,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_automation_scenarios_status ON automation_scenarios(status);
CREATE TABLE automation_scenario_revisions (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES automation_scenarios(id) ON UPDATE CASCADE ON DELETE CASCADE,
  version INTEGER NOT NULL,
  graph_json TEXT NOT NULL,
  tool_settings_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(scenario_id,version)
);
CREATE INDEX idx_automation_scenario_revisions_scenario ON automation_scenario_revisions(scenario_id,version DESC);
CREATE TABLE automation_skills (
  id TEXT PRIMARY KEY,
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
CREATE INDEX idx_automation_skills_status ON automation_skills(status,updated_at);
CREATE TABLE automation_agent_skills (
  agent_id TEXT NOT NULL REFERENCES automation_agents(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES automation_skills(id) ON DELETE CASCADE,
  PRIMARY KEY(agent_id,skill_id)
);

CREATE TABLE vector_stores (
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
CREATE TABLE vector_store_documents (
  id TEXT PRIMARY KEY,
  vector_store_id TEXT NOT NULL REFERENCES vector_stores(id) ON DELETE CASCADE,
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
  UNIQUE(vector_store_id,content_hash)
);
CREATE INDEX idx_vector_store_documents_store ON vector_store_documents(vector_store_id,status);
CREATE TABLE automation_agent_vector_stores (
  agent_id TEXT NOT NULL REFERENCES automation_agents(id) ON DELETE CASCADE,
  vector_store_id TEXT NOT NULL REFERENCES vector_stores(id) ON DELETE CASCADE,
  PRIMARY KEY(agent_id,vector_store_id)
);

CREATE TABLE chat_conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Новый диалог',
  mode TEXT NOT NULL DEFAULT 'chat' CHECK(mode IN ('chat','planner','agent','scenario')),
  agent_id TEXT REFERENCES automation_agents(id) ON DELETE SET NULL,
  last_usage TEXT NOT NULL DEFAULT '{"mode":"chat"}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE generation_runs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES automation_agents(id) ON DELETE SET NULL,
  model_id TEXT NOT NULL REFERENCES text_provider_models(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK(status IN ('queued','running','waiting_for_approval','completed','failed','cancelled')),
  current_step INTEGER NOT NULL DEFAULT 0,
  max_steps INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_generation_runs_conversation ON generation_runs(conversation_id,id);
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES generation_runs(id) ON DELETE SET NULL,
  execution_run_id TEXT REFERENCES execution_runs(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK(role IN ('system','user','assistant','tool')),
  status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('streaming','completed','failed','cancelled')),
  content_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_usage TEXT NOT NULL DEFAULT '{"mode":"chat"}'
);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id,id);
CREATE TABLE chat_attachments (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES chat_messages(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  local_path TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE generation_run_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  finish_reason TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(run_id,step_index)
);
CREATE TABLE generation_tool_calls (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES generation_runs(id) ON DELETE CASCADE,
  provider_call_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  risk TEXT NOT NULL CHECK(risk IN ('read','write','destructive')),
  status TEXT NOT NULL CHECK(status IN ('requested','waiting_for_approval','running','completed','failed','denied')),
  input_json TEXT NOT NULL,
  output_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  UNIQUE(run_id,provider_call_id)
);

CREATE TABLE execution_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind='scenario'),
  origin TEXT NOT NULL CHECK(origin IN ('manual','chat','background')),
  scenario_id TEXT NOT NULL REFERENCES automation_scenarios(id) ON DELETE CASCADE,
  scenario_revision_id TEXT NOT NULL REFERENCES automation_scenario_revisions(id) ON DELETE RESTRICT,
  conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','waiting_for_approval','completed','failed','cancelled')),
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checkpoint_json TEXT,
  engine_version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_execution_runs_scenario ON execution_runs(scenario_id,id DESC);
CREATE TABLE scenario_node_runs (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_kind TEXT NOT NULL,
  iteration INTEGER NOT NULL DEFAULT 1,
  attempt INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK(status IN ('queued','running','waiting_for_approval','completed','failed','cancelled','skipped')),
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
  UNIQUE(execution_id,node_id,iteration,attempt)
);
CREATE INDEX idx_scenario_node_runs_execution ON scenario_node_runs(execution_id,id);
CREATE TABLE llm_calls (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  node_run_id TEXT NOT NULL REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
  model_id TEXT REFERENCES text_provider_models(id) ON DELETE SET NULL,
  system_prompt TEXT,
  prompt_json TEXT,
  output_text TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  latency_ms INTEGER,
  finish_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_llm_calls_execution ON llm_calls(execution_id,id);
CREATE INDEX idx_llm_calls_node_run ON llm_calls(node_run_id);
CREATE TABLE execution_approvals (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  node_run_id TEXT NOT NULL REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','denied','expired')),
  prompt TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE INDEX idx_execution_approvals_pending ON execution_approvals(status,execution_id);

CREATE TABLE integration_profiles (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('telegram_bot','email_imap','github_connector','gitlab_connector')),
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'unchecked' CHECK(status IN ('unchecked','connected','error','disabled')),
  checked_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  connection_metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE integration_secret_bindings (
  profile_id TEXT NOT NULL REFERENCES integration_profiles(id) ON DELETE CASCADE,
  binding_key TEXT NOT NULL,
  secret_id TEXT NOT NULL REFERENCES secret_entities(id) ON DELETE RESTRICT,
  PRIMARY KEY(profile_id,binding_key)
);
CREATE TABLE scenario_trigger_bindings (
  id TEXT PRIMARY KEY,
  scenario_id TEXT NOT NULL REFERENCES automation_scenarios(id) ON DELETE CASCADE,
  scenario_revision_id TEXT NOT NULL REFERENCES automation_scenario_revisions(id) ON DELETE CASCADE,
  trigger_node_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('manual_chat','manual_editor','telegram','email','interval')),
  integration_profile_id TEXT REFERENCES integration_profiles(id) ON DELETE RESTRICT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_trigger_bindings_due ON scenario_trigger_bindings(kind,enabled,next_run_at);
CREATE INDEX idx_trigger_bindings_scenario ON scenario_trigger_bindings(scenario_id,scenario_revision_id);
CREATE TABLE trigger_cursors (
  binding_id TEXT PRIMARY KEY REFERENCES scenario_trigger_bindings(id) ON DELETE CASCADE,
  cursor_json TEXT NOT NULL DEFAULT '{}',
  polled_at TEXT,
  last_event_at TEXT,
  last_error TEXT
);
CREATE TABLE automation_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind='scenario_run'),
  deduplication_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','waiting','completed','failed','cancelled')),
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
CREATE INDEX idx_automation_jobs_ready ON automation_jobs(status,available_at,priority DESC,id);

CREATE TABLE scenario_file_jobs (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  node_run_id TEXT NOT NULL REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_external_id TEXT NOT NULL,
  integration_profile_id TEXT REFERENCES integration_profiles(id) ON DELETE RESTRICT,
  source_scope TEXT NOT NULL,
  input_json TEXT NOT NULL,
  cleanup_on_finish INTEGER NOT NULL DEFAULT 1 CHECK(cleanup_on_finish IN (0,1)),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','leased','completed','failed','cancelled')),
  lease_owner TEXT,
  lease_expires_at TEXT,
  attempt INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(execution_id,node_id,source_kind,source_scope,source_external_id)
);
CREATE INDEX idx_scenario_file_jobs_ready ON scenario_file_jobs(status,id);
CREATE TABLE execution_files (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  node_run_id TEXT NOT NULL REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL UNIQUE REFERENCES scenario_file_jobs(id) ON DELETE CASCADE,
  source_kind TEXT NOT NULL,
  source_external_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL CHECK(size >= 0),
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  local_path TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_execution_files_run ON execution_files(execution_id,node_run_id);
CREATE TABLE scenario_delivery_outbox (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  node_run_id TEXT NOT NULL REFERENCES scenario_node_runs(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK(channel IN ('telegram','email')),
  integration_profile_id TEXT NOT NULL REFERENCES integration_profiles(id) ON DELETE RESTRICT,
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
  completed_at TEXT
);
CREATE INDEX idx_scenario_delivery_ready ON scenario_delivery_outbox(status,available_at,id);

CREATE TABLE terminal_policy (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  confirmation_mode TEXT NOT NULL DEFAULT 'always' CHECK(confirmation_mode IN ('always','risky','policy')),
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 2 CHECK(max_concurrent_sessions BETWEEN 1 AND 16),
  default_timeout_seconds INTEGER NOT NULL DEFAULT 60 CHECK(default_timeout_seconds BETWEEN 1 AND 3600),
  max_timeout_seconds INTEGER NOT NULL DEFAULT 300 CHECK(max_timeout_seconds BETWEEN 1 AND 86400),
  max_output_bytes INTEGER NOT NULL DEFAULT 1048576 CHECK(max_output_bytes BETWEEN 4096 AND 16777216),
  allow_network INTEGER NOT NULL DEFAULT 0 CHECK(allow_network IN (0,1)),
  allowed_commands_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO terminal_policy(id) VALUES('00000000-0000-7000-8000-000000000101');
CREATE TABLE directory_policy (
  id TEXT PRIMARY KEY,
  grants_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO directory_policy(id) VALUES('00000000-0000-7000-8000-000000000102');
CREATE TABLE command_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES automation_agents(id) ON DELETE SET NULL,
  chat_run_id TEXT REFERENCES generation_runs(id) ON DELETE SET NULL,
  scenario_run_id TEXT REFERENCES execution_runs(id) ON DELETE SET NULL,
  tool_call_id TEXT REFERENCES generation_tool_calls(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  script TEXT NOT NULL,
  cwd TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending_approval','queued','running','completed','failed','cancelled','timed_out')),
  policy_snapshot_json TEXT NOT NULL,
  risk TEXT NOT NULL CHECK(risk IN ('low','medium','high','critical')),
  decision_reasons_json TEXT NOT NULL DEFAULT '[]',
  exit_code INTEGER,
  stdout_text TEXT NOT NULL DEFAULT '',
  stderr_text TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX idx_command_sessions_status ON command_sessions(status,created_at);
CREATE TABLE command_approval_requests (
  id TEXT PRIMARY KEY,
  command_session_id TEXT NOT NULL UNIQUE REFERENCES command_sessions(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','expired')),
  expires_at TEXT NOT NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_command_approvals_status ON command_approval_requests(status,expires_at);

CREATE TABLE memory_entries (
  search_rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'fact' CHECK(kind IN ('fact','preference','instruction','episode')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'chat' CHECK(source IN ('chat','scenario','manual')),
  conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE SET NULL,
  execution_id TEXT REFERENCES execution_runs(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES automation_agents(id) ON DELETE SET NULL,
  pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0,1)),
  hits INTEGER NOT NULL DEFAULT 0 CHECK(hits >= 0),
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_memory_entries_lookup ON memory_entries(pinned DESC,updated_at DESC);
CREATE UNIQUE INDEX idx_memory_entries_title ON memory_entries(title);
CREATE VIRTUAL TABLE memory_search USING fts5(
  title,content,tags,
  content='memory_entries',content_rowid='search_rowid',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER memory_entries_ai AFTER INSERT ON memory_entries BEGIN
  INSERT INTO memory_search(rowid,title,content,tags)
  VALUES(new.search_rowid,new.title,new.content,new.tags_json);
END;
CREATE TRIGGER memory_entries_ad AFTER DELETE ON memory_entries BEGIN
  INSERT INTO memory_search(memory_search,rowid,title,content,tags)
  VALUES('delete',old.search_rowid,old.title,old.content,old.tags_json);
END;
CREATE TRIGGER memory_entries_au AFTER UPDATE ON memory_entries BEGIN
  INSERT INTO memory_search(memory_search,rowid,title,content,tags)
  VALUES('delete',old.search_rowid,old.title,old.content,old.tags_json);
  INSERT INTO memory_search(rowid,title,content,tags)
  VALUES(new.search_rowid,new.title,new.content,new.tags_json);
END;
CREATE TABLE memory_policy (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  autosave INTEGER NOT NULL DEFAULT 1 CHECK(autosave IN (0,1)),
  allow_scenario_writes INTEGER NOT NULL DEFAULT 0 CHECK(allow_scenario_writes IN (0,1)),
  max_entries INTEGER NOT NULL DEFAULT 500 CHECK(max_entries > 0),
  max_content_chars INTEGER NOT NULL DEFAULT 2000 CHECK(max_content_chars > 0),
  injected_entries INTEGER NOT NULL DEFAULT 12 CHECK(injected_entries >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO memory_policy(id) VALUES('00000000-0000-7000-8000-000000000103');

CREATE TABLE task_plans (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE CASCADE,
  execution_id TEXT REFERENCES execution_runs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_task_plans_conversation ON task_plans(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE UNIQUE INDEX idx_task_plans_execution ON task_plans(execution_id) WHERE execution_id IS NOT NULL;
CREATE TABLE task_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES task_plans(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','skipped')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_task_items_plan ON task_items(plan_id,position);
CREATE TABLE user_questions (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK(scope IN ('chat','scenario')),
  conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES generation_runs(id) ON DELETE CASCADE,
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
CREATE INDEX idx_user_questions_pending ON user_questions(status,expires_at);
CREATE INDEX idx_user_questions_execution ON user_questions(execution_id,node_id);
CREATE INDEX idx_user_questions_correlation ON user_questions(channel,correlation_id) WHERE status='pending';
CREATE INDEX idx_user_questions_conversation ON user_questions(conversation_id,status);

CREATE TABLE user_profile (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO user_profile(id) VALUES('00000000-0000-7000-8000-000000000104');
CREATE TABLE entity_generation_runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('agent','skill')),
  model_id TEXT NOT NULL REFERENCES text_provider_models(id) ON DELETE RESTRICT,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed','cancelled')),
  entity_id TEXT,
  entity_name TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX idx_entity_generation_runs_created_at ON entity_generation_runs(created_at DESC);
`;
