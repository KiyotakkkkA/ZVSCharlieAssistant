import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import {
  parseJsonDto,
  textProviderGenerationSettingsDtoSchema,
  textProviderModelDetailsDtoSchema,
  type TextProviderGenerationSettings,
} from "../../../shared/dto";

import { ChatRepository } from "../database/chat.repository";
import { SecretStorageRepository } from "../database/secret-storage.repository";
export interface ModelRuntimeInfo {
  modelId: string;
  remoteId: string;
  kind: string;
  contextLength: number | null;
  maxCompletionTokens: number | null;
  promptPricePerToken: number;
  completionPricePerToken: number;
}

export class ProviderRegistry {
  constructor(
    private readonly data: ChatRepository,
    private readonly secrets: SecretStorageRepository,
  ) {}
  resolve(modelId: string): LanguageModel {
    const row = this.data.resolveModel(modelId);
    if (!row) throw new Error("Модель отключена или не найдена");
    const apiKey = row.api_key_secret_id
      ? this.secrets.findSecret(row.api_key_secret_id)?.content
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

  modelInfo(modelId: string): ModelRuntimeInfo {
    const row = this.data.resolveModel(modelId);
    if (!row) throw new Error("Модель отключена или не найдена");
    const details = parseJsonDto(
      textProviderModelDetailsDtoSchema,
      row.details_json || "{}",
    );
    return {
      modelId: row.id,
      remoteId: row.remote_id,
      kind: row.kind,
      contextLength: details.contextLength ?? null,
      maxCompletionTokens: details.maxCompletionTokens ?? null,
      promptPricePerToken: parsePrice(details.promptPrice),
      completionPricePerToken: parsePrice(details.completionPrice),
    };
  }

  generationSettings(modelId: string): TextProviderGenerationSettings {
    const row = this.data.resolveModel(modelId);
    if (!row) throw new Error("Модель отключена или не найдена");
    const configured = textProviderGenerationSettingsDtoSchema
      .partial()
      .parse(JSON.parse(row.generation_settings_json || "{}") as unknown);
    const details = parseJsonDto(
      textProviderModelDetailsDtoSchema,
      row.details_json || "{}",
    );
    const requested = configured.maxOutputTokens ?? 8192;
    return {
      maxOutputTokens: details.maxCompletionTokens
        ? Math.min(requested, details.maxCompletionTokens)
        : requested,
      temperature: configured.temperature ?? 0.7,
      topP: configured.topP ?? 0.9,
    };
  }
}

function parsePrice(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
