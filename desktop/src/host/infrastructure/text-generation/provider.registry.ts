import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import {
  parseJsonDto,
  textProviderGenerationSettingsDtoSchema,
  textProviderModelDetailsDtoSchema,
  type TextProviderGenerationSettings,
} from "../../../shared/dto";
import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import { ChatDataSource } from "../database/chat.data-source";
export class ProviderRegistry {
  constructor(
    private readonly data: ChatDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}
  resolve(modelId: number): LanguageModel {
    const row = this.data.resolveModel(modelId);
    if (!row) throw new Error("Модель отключена или не найдена");
    const apiKey = row.api_key_secret_id
      ? this.secrets.getSecret(row.api_key_secret_id)?.content
      : undefined;
    const provider = createOpenAICompatible({
      name: row.kind,
      baseURL:
        row.kind === "ollama"
          ? `${row.base_url.replace(/\/+$/, "")}/v1`
          : row.base_url.replace(/\/+$/, ""),
      apiKey: apiKey || (row.kind === "ollama" ? "ollama" : undefined),
      headers:
        row.kind === "openrouter"
          ? { "X-OpenRouter-Title": "ZVS Assistant" }
          : undefined,
    });
    return provider.chatModel(row.remote_id);
  }

  generationSettings(modelId: number): TextProviderGenerationSettings {
    const row = this.data.resolveModel(modelId);
    if (!row) throw new Error("Модель отключена или не найдена");
    const configured = textProviderGenerationSettingsDtoSchema.partial().parse(
      JSON.parse(row.generation_settings_json || "{}") as unknown,
    );
    const details = parseJsonDto(
      textProviderModelDetailsDtoSchema,
      row.details_json || "{}",
    );
    const requested = configured.maxOutputTokens ?? 2048;
    return {
      maxOutputTokens: details.maxCompletionTokens
        ? Math.min(requested, details.maxCompletionTokens)
        : requested,
      temperature: configured.temperature ?? 0.7,
      topP: configured.topP ?? 0.9,
    };
  }
}
