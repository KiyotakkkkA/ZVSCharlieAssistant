export const MODEL_CHAIN_SCHEMA_SQL = `
ALTER TABLE generation_runs ADD COLUMN model_switches_json TEXT NOT NULL DEFAULT '[]';
`;
