import type Database from "better-sqlite3";
import type { TextProviderConfig, TextProviderModel, TextProviderModelDetails, TextProviderModelInfo, TextProviderSnapshot, UpsertTextProviderInput } from "../../../ipc/contracts/text-provider.contract";
interface ProviderRow { id: number; kind: TextProviderConfig["kind"]; name: string; base_url: string; api_key_secret_id: number | null; enabled: number; checked_at: string; created_at: string; updated_at: string }
interface ModelRow { provider_id: number; remote_id: string; name: string; modified_at: string; size: number; digest: string; details_json: string; enabled: number }
export class TextProviderDataSource {
  constructor(private readonly database: Database.Database) {}
  getSnapshot(): TextProviderSnapshot { const providers = this.database.prepare("SELECT * FROM text_provider_configs ORDER BY created_at").all() as ProviderRow[]; const models = this.database.prepare("SELECT * FROM text_provider_models ORDER BY name COLLATE NOCASE").all() as ModelRow[]; return { providers: providers.map(mapProvider), models: models.map(mapModel) }; }
  upsert(input: UpsertTextProviderInput, id: number | undefined, checkedAt: string, models: TextProviderModelInfo[]): TextProviderSnapshot {
    this.database.transaction(() => {
      let providerId = id;
      if (providerId === undefined) providerId = Number(this.database.prepare("INSERT INTO text_provider_configs (kind, name, base_url, api_key_secret_id, enabled, checked_at) VALUES (?, ?, ?, ?, ?, ?)").run(input.kind, input.name, input.baseUrl, input.apiKeySecretId ?? null, Number(input.enabled), checkedAt).lastInsertRowid);
      else { const result = this.database.prepare("UPDATE text_provider_configs SET kind=?, name=?, base_url=?, api_key_secret_id=?, enabled=?, checked_at=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").run(input.kind, input.name, input.baseUrl, input.apiKeySecretId ?? null, Number(input.enabled), checkedAt, providerId); if (!result.changes) throw new Error("Провайдер не найден"); }
      this.database.prepare("DELETE FROM text_provider_models WHERE provider_id=?").run(providerId);
      const insert = this.database.prepare("INSERT INTO text_provider_models (provider_id, remote_id, name, modified_at, size, digest, details_json, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      for (const model of models) insert.run(providerId, model.id, model.name, model.modifiedAt, model.size, model.digest, JSON.stringify(model.details), Number(input.enabledModelIds.includes(model.id)));
    })();
    return this.getSnapshot();
  }
  delete(id: number): TextProviderSnapshot { const result = this.database.prepare("DELETE FROM text_provider_configs WHERE id=?").run(id); if (!result.changes) throw new Error("Провайдер не найден"); return this.getSnapshot(); }
}
const mapProvider = (row: ProviderRow): TextProviderConfig => ({ id: row.id, kind: row.kind, name: row.name, baseUrl: row.base_url, apiKeySecretId: row.api_key_secret_id, enabled: Boolean(row.enabled), checkedAt: row.checked_at, createdAt: row.created_at, updatedAt: row.updated_at });
const mapModel = (row: ModelRow): TextProviderModel => ({ providerId: row.provider_id, id: row.remote_id, name: row.name, modifiedAt: row.modified_at, size: row.size, digest: row.digest, details: JSON.parse(row.details_json) as TextProviderModelDetails, enabled: Boolean(row.enabled) });
