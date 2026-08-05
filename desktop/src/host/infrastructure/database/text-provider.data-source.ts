import type Database from "better-sqlite3";
import type {
  TextProviderConfig,
  TextProviderModel,
  TextProviderModelInfo,
  TextProviderSnapshot,
} from "../../../shared/models/text-provider";
import {
  parseJsonDto,
  textProviderGenerationSettingsDtoSchema,
  textProviderLimitsDtoSchema,
  textProviderModelDetailsDtoSchema,
  type TextProviderLimits,
} from "../../../shared/dto";
import type {
  TextProviderGenerationSettings,
  UpsertTextProviderInput,
} from "../../../shared/dto";
interface ProviderRow {
  id: number;
  kind: TextProviderConfig["kind"];
  provider_type: TextProviderConfig["providerType"];
  name: string;
  base_url: string;
  api_key_secret_id: number | null;
  enabled: number;
  checked_at: string;
  created_at: string;
  updated_at: string;
  limits_json: string | null;
  generation_settings_json: string;
}
interface ModelRow {
  id: number;
  provider_id: number;
  remote_id: string;
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details_json: string;
  enabled: number;
}
export class TextProviderDataSource {
  constructor(private readonly database: Database.Database) {}
  getSnapshot(): TextProviderSnapshot {
    const providers = this.database
      .prepare("SELECT * FROM text_provider_configs ORDER BY created_at")
      .all() as ProviderRow[];
    const models = this.database
      .prepare(
        "SELECT * FROM text_provider_models ORDER BY name COLLATE NOCASE",
      )
      .all() as ModelRow[];
    return {
      providers: providers.map(mapProvider),
      models: models.map(mapModel),
    };
  }
  upsert(
    input: UpsertTextProviderInput,
    id: number | undefined,
    checkedAt: string,
    models: TextProviderModelInfo[],
    limits: TextProviderLimits | null,
  ): TextProviderSnapshot {
    this.database.transaction(() => {
      let providerId = id;
      if (providerId === undefined)
        providerId = Number(
          this.database
            .prepare(
              "INSERT INTO text_provider_configs (kind, provider_type, name, base_url, api_key_secret_id, enabled, checked_at, limits_json, generation_settings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
              input.kind,
              input.providerType,
              input.name,
              input.baseUrl,
              input.apiKeySecretId ?? null,
              Number(input.enabled),
              checkedAt,
              limits ? JSON.stringify(limits) : null,
              JSON.stringify(input.generationSettings),
            ).lastInsertRowid,
        );
      else {
        const result = this.database
          .prepare(
            "UPDATE text_provider_configs SET kind=?, provider_type=?, name=?, base_url=?, api_key_secret_id=?, enabled=?, checked_at=?, limits_json=?, generation_settings_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
          )
          .run(
            input.kind,
            input.providerType,
            input.name,
            input.baseUrl,
            input.apiKeySecretId ?? null,
            Number(input.enabled),
            checkedAt,
            limits ? JSON.stringify(limits) : null,
            JSON.stringify(input.generationSettings),
            providerId,
          );
        if (!result.changes) throw new Error("Провайдер не найден");
      }
      this.database
        .prepare(
          "UPDATE text_provider_models SET enabled=0 WHERE provider_id=?",
        )
        .run(providerId);
      const insert = this.database.prepare(
        `INSERT INTO text_provider_models (
           provider_id, remote_id, name, modified_at, size, digest,
           details_json, enabled
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider_id, remote_id) DO UPDATE SET
           name = excluded.name,
           modified_at = excluded.modified_at,
           size = excluded.size,
           digest = excluded.digest,
           details_json = excluded.details_json,
           enabled = excluded.enabled`,
      );
      for (const model of models)
        insert.run(
          providerId,
          model.id,
          model.name,
          model.modifiedAt,
          model.size,
          model.digest,
          JSON.stringify(model.details),
          Number(input.enabledModelIds.includes(model.id)),
        );
    })();
    return this.getSnapshot();
  }
  delete(id: number): TextProviderSnapshot {
    const result = this.database
      .prepare("DELETE FROM text_provider_configs WHERE id=?")
      .run(id);
    if (!result.changes) throw new Error("Провайдер не найден");
    return this.getSnapshot();
  }
}
const mapProvider = (row: ProviderRow): TextProviderConfig => ({
  id: row.id,
  kind: row.kind,
  providerType: row.provider_type,
  name: row.name,
  baseUrl: row.base_url,
  apiKeySecretId: row.api_key_secret_id,
  enabled: Boolean(row.enabled),
  checkedAt: row.checked_at,
  limits: row.limits_json
    ? parseJsonDto(textProviderLimitsDtoSchema, row.limits_json)
    : null,
  generationSettings: parseGenerationSettings(row.generation_settings_json),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const parseGenerationSettings = (
  value: string,
): TextProviderGenerationSettings => {
  const parsed = textProviderGenerationSettingsDtoSchema.partial().parse(
    JSON.parse(value || "{}") as unknown,
  );
  return {
    maxOutputTokens: parsed.maxOutputTokens ?? 2048,
    temperature: parsed.temperature ?? 0.7,
    topP: parsed.topP ?? 0.9,
  };
};
const mapModel = (row: ModelRow): TextProviderModel => ({
  providerId: row.provider_id,
  id: row.id,
  remoteId: row.remote_id,
  name: row.name,
  modifiedAt: row.modified_at,
  size: row.size,
  digest: row.digest,
  details: parseJsonDto(textProviderModelDetailsDtoSchema, row.details_json),
  enabled: Boolean(row.enabled),
});
