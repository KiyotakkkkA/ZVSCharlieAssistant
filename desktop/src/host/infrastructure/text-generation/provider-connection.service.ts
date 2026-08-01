import type { SecretStorageRepository } from "../../domain/repositories/secret-storage.repository";
import type { TextProviderRepository } from "../../domain/repositories/text-provider.repository";
import type {
  TestTextProviderConnectionInput,
  TestTextProviderConnectionResult,
  TextProviderKind,
  TextProviderModelInfo,
  TextProviderSnapshot,
  UpsertTextProviderInput,
} from "../../../ipc/contracts";

const API_KEYS_CATEGORY_ID = 1;

interface ProviderConnectionRequest {
  baseUrl: string;
  apiKey?: string;
}

interface ProviderConnectionChecker {
  test(request: ProviderConnectionRequest): Promise<TextProviderModelInfo[]>;
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    model?: string;
    modified_at?: string;
    size?: number;
    digest?: string;
    details?: {
      parent_model?: string;
      format?: string;
      family?: string;
      families?: string[] | null;
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

class OllamaConnectionChecker implements ProviderConnectionChecker {
  async test({
    baseUrl,
    apiKey,
  }: ProviderConnectionRequest): Promise<TextProviderModelInfo[]> {
    const endpoint = `${normalizeBaseUrl(baseUrl)}/api/tags`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Ollama вернул HTTP ${response.status}`);
    }

    const payload = (await response.json()) as OllamaTagsResponse;
    if (!Array.isArray(payload.models)) {
      throw new Error("Ollama вернул ответ без массива models");
    }

    return payload.models.map((model, index) => {
      const id = model.model?.trim() || model.name?.trim();
      if (!id)
        throw new Error(`Модель Ollama под индексом ${index} не имеет имени`);
      return {
        id,
        name: model.name?.trim() || id,
        modifiedAt: model.modified_at ?? "",
        size: Number.isFinite(model.size) ? Number(model.size) : 0,
        digest: model.digest ?? "",
        details: {
          parentModel: model.details?.parent_model ?? "",
          format: model.details?.format ?? "",
          family: model.details?.family ?? "",
          families: model.details?.families ?? null,
          parameterSize: model.details?.parameter_size ?? "",
          quantizationLevel: model.details?.quantization_level ?? "",
        },
      };
    });
  }
}

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) throw new Error("Base API URL обязателен");
  const url = new URL(normalized);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base API URL должен использовать HTTP или HTTPS");
  }
  return url.toString().replace(/\/+$/, "");
}

export class ProviderConnectionService {
  private readonly checkers: Record<
    TextProviderKind,
    ProviderConnectionChecker
  > = {
    ollama: new OllamaConnectionChecker(),
  };

  constructor(
    private readonly secrets: SecretStorageRepository,
    private readonly providers: TextProviderRepository,
  ) {}

  getSnapshot(): TextProviderSnapshot {
    return this.providers.getSnapshot();
  }

  async testConnection(
    input: TestTextProviderConnectionInput,
  ): Promise<TestTextProviderConnectionResult> {
    const checker = this.checkers[input.kind];
    if (!checker) throw new Error(`Провайдер ${input.kind} не поддерживается`);

    let apiKey: string | undefined;
    if (input.apiKeySecretId !== undefined) {
      const secret = this.secrets.getSecret(input.apiKeySecretId);
      if (!secret) throw new Error("Выбранный API-ключ не найден");
      if (secret.categoryId !== API_KEYS_CATEGORY_ID) {
        throw new Error("Ключ должен принадлежать категории «Ключи API»");
      }
      apiKey = secret.content;
    }

    const models = await checker.test({ baseUrl: input.baseUrl, apiKey });
    return { models, checkedAt: new Date().toISOString() };
  }

  async upsertProvider(
    input: UpsertTextProviderInput,
  ): Promise<TextProviderSnapshot> {
    const name = input.name.trim();
    if (!name) throw new Error("Название провайдера обязательно");
    const result = await this.testConnection(input);
    const availableIds = new Set(result.models.map((model) => model.id));
    const enabledModelIds = input.enabledModelIds.filter((id) =>
      availableIds.has(id),
    );
    return this.providers.upsert(
      {
        ...input,
        name,
        baseUrl: normalizeBaseUrl(input.baseUrl),
        enabledModelIds,
      },
      input.id,
      result.checkedAt,
      result.models,
    );
  }

  deleteProvider(id: number): TextProviderSnapshot {
    return this.providers.delete(id);
  }
}
