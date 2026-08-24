export const CODER_MODE_SCHEMA_SQL = `
CREATE TABLE context_segments (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  from_message_id TEXT NOT NULL,
  to_message_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  model_id TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  tokens_before INTEGER NOT NULL DEFAULT 0,
  tokens_after INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL CHECK(reason IN ('threshold','overflow','manual','model_switch')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_context_segments_conversation
  ON context_segments(conversation_id,from_message_id);

ALTER TABLE chat_messages ADD COLUMN compacted_into TEXT
  REFERENCES context_segments(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD COLUMN token_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE generation_runs ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE generation_runs ADD COLUMN cached_input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE generation_runs ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0;
ALTER TABLE generation_run_steps ADD COLUMN reasoning_tokens INTEGER NOT NULL DEFAULT 0;

CREATE TABLE file_checkpoints (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES generation_runs(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  existed INTEGER NOT NULL DEFAULT 1 CHECK(existed IN (0,1)),
  backup_path TEXT,
  bytes_before INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_file_checkpoints_run ON file_checkpoints(run_id,path);

CREATE TABLE file_edits (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES generation_runs(id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES chat_conversations(id) ON DELETE CASCADE,
  checkpoint_id TEXT REFERENCES file_checkpoints(id) ON DELETE SET NULL,
  tool_call_id TEXT,
  path TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create','modify','delete','move')),
  moved_to TEXT,
  diff TEXT NOT NULL DEFAULT '',
  bytes_before INTEGER NOT NULL DEFAULT 0,
  bytes_after INTEGER NOT NULL DEFAULT 0,
  reverted INTEGER NOT NULL DEFAULT 0 CHECK(reverted IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_file_edits_run ON file_edits(run_id,id);
CREATE INDEX idx_file_edits_conversation ON file_edits(conversation_id,id);
`;
