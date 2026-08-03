import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import type { TextProviderRepository } from "../../application/ports/text-provider.repository";
import type {
  TestTextProviderConnectionInput,
  TestTextProviderConnectionResult,
  TextProviderKind,
  TextProviderLimits,
  TextProviderModelInfo,
  TextProviderSnapshot,
  UpsertTextProviderInput,
} from "../../domain/models/text-provider";

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
  async test({
    baseUrl,
    apiKey,
  }: ProviderConnectionRequest): Promise<{
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
      throw new Error(`Ollama вернул HTTP ${response.status}`);
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
        `OpenRouter models API вернул HTTP ${modelsResponse.status}`,
      );
    if (!zdrModelsResponse.ok)
      throw new Error(
        `OpenRouter ZDR models API вернул HTTP ${zdrModelsResponse.status}`,
      );
    if (!keyResponse.ok)
      throw new Error(`OpenRouter key API вернул HTTP ${keyResponse.status}`);
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
    // The models catalogue does not expose endpoint data policies on each
    // model. `zdr=true` is the only documented catalogue-level privacy
    // filter. A ZDR endpoint neither retains prompts nor trains on them, so it
    // is also a guaranteed (albeit deliberately conservative) no-training
    // match.
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
