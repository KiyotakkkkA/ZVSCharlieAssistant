import type {
  TestTextProviderConnectionResult,
  TextProviderModelInfo,
  TextProviderSnapshot,
} from "../../../shared/models/text-provider";
import type {
  TestTextProviderConnectionInput,
  TextProviderKind,
  TextProviderLimits,
  UpsertTextProviderInput,
} from "../../../shared/dto";
import { SecretStorageRepository } from "../database/secret-storage.repository";
import { describeProviderHttpError } from "./provider-error";
import { TextProviderRepository } from "../database/text-provider.repository";

const API_KEYS_CATEGORY_ID = 1;

interface ProviderConnectionRequest {
  baseUrl: string;
  apiKey?: string;
  providerType: "text" | "embedding";
}

interface ProviderConnectionChecker {
  test(request: ProviderConnectionRequest): Promise<{
    models: TextProviderModelInfo[];
    limits: TextProviderLimits | null;
  }>;
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
  async test({ baseUrl, apiKey }: ProviderConnectionRequest): Promise<{
    models: TextProviderModelInfo[];
    limits: null;
  }> {
    const endpoint = `${normalizeBaseUrl(baseUrl)}/api/tags`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(describeProviderHttpError("Ollama", response.status));
    }

    const payload = (await response.json()) as OllamaTagsResponse;
    if (!Array.isArray(payload.models)) {
      throw new Error("Ollama вернул ответ без массива models");
    }

    const models = payload.models.map((model, index) => {
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
    return { models, limits: null };
  }
}

interface OpenRouterModelsResponse {
  data?: Array<{
    id?: string;
    name?: string;
    created?: number;
    description?: string;
    context_length?: number;
    architecture?: {
      input_modalities?: string[];
      output_modalities?: string[];
      tokenizer?: string;
      instruct_type?: string | null;
    };
    pricing?: { prompt?: string; completion?: string; request?: string };
    supported_parameters?: string[];
    top_provider?: {
      context_length?: number;
      max_completion_tokens?: number;
      is_moderated?: boolean;
    };
  }>;
}

interface OpenRouterKeyResponse {
  data?: {
    limit?: number | null;
    limit_remaining?: number | null;
    limit_reset?: string | null;
    usage?: number;
    usage_daily?: number;
    usage_weekly?: number;
    usage_monthly?: number;
    is_free_tier?: boolean;
    expires_at?: string | null;
  };
}

interface MistralModelsResponse {
  data?: Array<{
    id?: string;
    object?: string;
    created?: number;
    owned_by?: string;
    root?: string;
    max_context_length?: number;
    aliases?: string[];
    archived?: boolean;
    capabilities?: {
      completion_chat?: boolean;
      completion_fim?: boolean;
      function_calling?: boolean;
      fine_tuning?: boolean;
      vision?: boolean;
      classification?: boolean;
    };
  }>;
}

class MistralConnectionChecker implements ProviderConnectionChecker {
  async test({
    baseUrl,
    apiKey,
    providerType,
  }: ProviderConnectionRequest): Promise<{
    models: TextProviderModelInfo[];
    limits: null;
  }> {
    if (!apiKey?.trim()) throw new Error("Для Mistral требуется API-ключ");

    const root = normalizeBaseUrl(baseUrl);
    const response = await fetch(`${root}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(
        describeProviderHttpError("Mistral (список моделей)", response.status),
      );
    }

    const payload = (await response.json()) as MistralModelsResponse;

    if (!Array.isArray(payload.data)) {
      throw new Error("Mistral вернул ответ без массива data");
    }

    const availableModels = payload.data.filter((model) => {
      if (model.archived) return false;

      const id = model.id?.trim().toLowerCase() ?? "";
      const rootModel = model.root?.trim().toLowerCase() ?? "";
      const isEmbeddingModel =
        id.includes("embed") || rootModel.includes("embed");

      if (providerType === "embedding") {
        return isEmbeddingModel;
      }

      return model.capabilities?.completion_chat === true && !isEmbeddingModel;
    });

    const models = availableModels.map((model, index) => {
      const id = model.id?.trim();
      if (!id) {
        throw new Error(`Модель Mistral под индексом ${index} не имеет id`);
      }

      return {
        id,
        name: id,
        modifiedAt: model.created
          ? new Date(model.created * 1000).toISOString()
          : "",
        size: 0,
        digest: "",
        details: {
          parentModel: model.root ?? "",
          format: "",
          family: model.owned_by ?? "mistral",
          families: null,
          parameterSize: "",
          quantizationLevel: "",
          contextLength: model.max_context_length,
          inputModalities: model.capabilities?.vision
            ? ["text", "image"]
            : ["text"],
          outputModalities:
            providerType === "embedding" ? ["embeddings"] : ["text"],
          supportedParameters: [
            ...(model.capabilities?.function_calling ? ["tools"] : []),
            ...(model.capabilities?.completion_fim ? ["fim"] : []),
            ...(model.capabilities?.vision ? ["vision"] : []),
          ],
          description: [
            model.capabilities?.function_calling ? "Function calling" : null,
            model.capabilities?.vision ? "Vision" : null,
            model.capabilities?.completion_fim ? "FIM" : null,
            model.capabilities?.fine_tuning ? "Fine-tuning" : null,
          ]
            .filter(Boolean)
            .join(", "),
        },
      };
    });

    return { models, limits: null };
  }
}

class OpenRouterConnectionChecker implements ProviderConnectionChecker {
  async test({ baseUrl, apiKey, providerType }: ProviderConnectionRequest) {
    if (!apiKey?.trim()) throw new Error("Для OpenRouter требуется API-ключ");
    const root = normalizeBaseUrl(baseUrl);
    const headers = { Authorization: `Bearer ${apiKey.trim()}` };
    const output = providerType === "embedding" ? "embeddings" : "text";
    const [modelsResponse, zdrModelsResponse, keyResponse] = await Promise.all([
      fetch(`${root}/models?output_modalities=${output}`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      }),
      fetch(`${root}/models?output_modalities=${output}&zdr=true`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      }),
      fetch(`${root}/key`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      }),
    ]);
    if (!modelsResponse.ok)
      throw new Error(
        describeProviderHttpError(
          "OpenRouter (список моделей)",
          modelsResponse.status,
        ),
      );
    if (!zdrModelsResponse.ok)
      throw new Error(
        describeProviderHttpError(
          "OpenRouter (модели без хранения данных)",
          zdrModelsResponse.status,
        ),
      );
    if (!keyResponse.ok)
      throw new Error(
        describeProviderHttpError(
          "OpenRouter (проверка ключа)",
          keyResponse.status,
        ),
      );
    const modelPayload =
      (await modelsResponse.json()) as OpenRouterModelsResponse;
    const zdrModelPayload =
      (await zdrModelsResponse.json()) as OpenRouterModelsResponse;
    const keyPayload = (await keyResponse.json()) as OpenRouterKeyResponse;
    if (!Array.isArray(modelPayload.data))
      throw new Error("OpenRouter вернул ответ без массива data");
    if (!Array.isArray(zdrModelPayload.data))
      throw new Error("OpenRouter вернул некорректный список ZDR-моделей");
    if (!keyPayload.data)
      throw new Error("OpenRouter не вернул данные API-ключа");
    const zdrModelIds = new Set(
      zdrModelPayload.data.flatMap((model) =>
        model.id?.trim() ? [model.id.trim()] : [],
      ),
    );
    const models = modelPayload.data.map((model, index) => {
      const id = model.id?.trim();
      if (!id)
        throw new Error(`Модель OpenRouter под индексом ${index} не имеет id`);
      return {
        id,
        name: model.name?.trim() || id,
        modifiedAt: model.created
          ? new Date(model.created * 1000).toISOString()
          : "",
        size: 0,
        digest: "",
        details: {
          parentModel: "",
          format: "",
          family: id.split("/")[0] ?? "",
          families: null,
          parameterSize: "",
          quantizationLevel: "",
          contextLength:
            model.context_length ?? model.top_provider?.context_length,
          maxCompletionTokens: model.top_provider?.max_completion_tokens,
          inputModalities: model.architecture?.input_modalities ?? [],
          outputModalities: model.architecture?.output_modalities ?? [],
          tokenizer: model.architecture?.tokenizer,
          instructType: model.architecture?.instruct_type,
          isModerated: model.top_provider?.is_moderated,
          doesNotTrain: zdrModelIds.has(id),
          zeroDataRetention: zdrModelIds.has(id),
          promptPrice: model.pricing?.prompt ?? "0",
          completionPrice: model.pricing?.completion ?? "0",
          requestPrice: model.pricing?.request ?? "0",
          supportedParameters: model.supported_parameters ?? [],
          description: model.description ?? "",
        },
      };
    });
    const key = keyPayload.data;
    return {
      models,
      limits: {
        limit: key.limit ?? null,
        limitRemaining: key.limit_remaining ?? null,
        limitReset: key.limit_reset ?? null,
        usage: key.usage ?? 0,
        usageDaily: key.usage_daily ?? 0,
        usageWeekly: key.usage_weekly ?? 0,
        usageMonthly: key.usage_monthly ?? 0,
        isFreeTier: key.is_free_tier ?? false,
        expiresAt: key.expires_at ?? null,
      },
    };
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
    openrouter: new OpenRouterConnectionChecker(),
    mistral: new MistralConnectionChecker(),
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
      const secret = this.secrets.findSecret(input.apiKeySecretId);
      if (!secret) throw new Error("Выбранный API-ключ не найден");
      if (secret.categoryId !== API_KEYS_CATEGORY_ID) {
        throw new Error("Ключ должен принадлежать категории «Ключи API»");
      }
      apiKey = secret.content;
    }

    const result = await checker.test({
      baseUrl: input.baseUrl,
      apiKey,
      providerType: input.providerType,
    });
    return { ...result, checkedAt: new Date().toISOString() };
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
      result.limits,
    );
  }

  deleteProvider(id: number): TextProviderSnapshot {
    return this.providers.delete(id);
  }
}
