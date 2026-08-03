import type { SecretStorageRepository } from "../../domain/repositories/secret-storage.repository";
import type { AutomationDataSource } from "../database/automation.data-source";

export type OllamaWebToolId = "web.search" | "web.fetch";

export class OllamaWebService {
  constructor(
    private readonly automationData: AutomationDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}

  async execute(
    toolId: OllamaWebToolId,
    body: { query: string } | { url: string },
    signal: AbortSignal,
  ): Promise<unknown> {
    const secretId = this.automationData.toolSecretId(toolId, "ollamaApiKey");
    const apiKey = secretId
      ? this.secrets.getSecret(secretId)?.content.trim()
      : "";
    if (!apiKey)
      throw new Error(`Для инструмента «${toolId}» не настроен Ollama API key`);

    const response = await fetch(
      `https://ollama.com/api/${toolId.replace(".", "_")}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      },
    );
    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(
        `Ollama ${toolId} вернул ${response.status}${details ? `: ${details}` : ""}`,
      );
    }
    return response.json() as Promise<unknown>;
  }
}
