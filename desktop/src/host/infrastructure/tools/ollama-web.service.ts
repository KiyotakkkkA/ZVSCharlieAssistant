import type { AutomationRuntimeCatalog } from "../../application/ports/automation-runtime.ports";
import { SecretStorageRepository } from "../database/secret-storage.repository";
import { describeProviderHttpError } from "../text-generation/provider-error";

export type OllamaWebToolId = "web_search" | "web_fetch";

export class OllamaWebService {
  constructor(
    private readonly automationCatalog: Pick<
      AutomationRuntimeCatalog,
      "toolSecretId"
    >,
    private readonly secrets: SecretStorageRepository,
  ) {}

  async execute(
    toolId: OllamaWebToolId,
    body: { query: string } | { url: string },
    signal: AbortSignal,
  ): Promise<unknown> {
    const secretId = this.automationCatalog.toolSecretId(
      toolId,
      "ollamaApiKey",
    );
    const apiKey = secretId
      ? this.secrets.findSecret(secretId)?.content.trim()
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
      throw new Error(
        describeProviderHttpError(
          `Ollama (${toolId})`,
          response.status,
          await response.text(),
        ),
      );
    }
    return response.json() as Promise<unknown>;
  }
}
