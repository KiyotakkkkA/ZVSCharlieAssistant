export const PROJECT_SCHEMA_SQL = `
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  default_agent_id TEXT REFERENCES automation_agents(id) ON DELETE SET NULL,
  default_model_id TEXT REFERENCES text_provider_models(id) ON DELETE SET NULL,
  compact_threshold REAL NOT NULL DEFAULT 0.78,
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE project_directory_grants (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  recursive INTEGER NOT NULL DEFAULT 1 CHECK(recursive IN (0,1)),
  permissions_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_project_grants_project ON project_directory_grants(project_id);

ALTER TABLE chat_conversations ADD COLUMN project_id TEXT
  REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE memory_entries ADD COLUMN project_id TEXT
  REFERENCES projects(id) ON DELETE SET NULL;
`;
