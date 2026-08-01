import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { SecretStorageRepository } from "../../domain/repositories/secret-storage.repository";
import { ChatDataSource } from "../database/chat.data-source";
export class ProviderRegistry {
  constructor(
    private readonly data: ChatDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}
  resolve(modelId: number): LanguageModel {
    const row = this.data.resolveModel(modelId);
    if (!row) throw new Error("Модель отключена или не найдена");
    if (row.kind !== "ollama")
      throw new Error(`Провайдер ${row.kind} пока не поддерживается runtime`);
    const apiKey = row.api_key_secret_id
      ? this.secrets.getSecret(row.api_key_secret_id)?.content
      : undefined;
    const provider = createOpenAICompatible({
      name: `ollama-${modelId}`,
      baseURL: `${row.base_url.replace(/\/+$/, "")}/v1`,
      apiKey: apiKey || "ollama",
    });
    return provider.chatModel(row.remote_id);
  }
}
