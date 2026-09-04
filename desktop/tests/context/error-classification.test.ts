import { describe, expect, it } from "vitest";
import { APICallError, LoadAPIKeyError, RetryError } from "ai";
import { ModelFailover } from "../../src/host/infrastructure/text-generation/model-failover";
import type { ChatRepository } from "../../src/host/infrastructure/database/chat.repository";
import type { ProviderRegistry } from "../../src/host/infrastructure/text-generation/provider.registry";

function createFailover() {
  const data = {
    listEnabledTextModels: () => [],
    recordModelSwitch: () => undefined,
  } as unknown as ChatRepository;
  const providers = {
    modelInfo: () => ({ contextLength: 0 }),
    generationSettings: () => ({ maxOutputTokens: 0 }),
  } as unknown as ProviderRegistry;
  return new ModelFailover(data, providers);
}

function apiError(options: {
  message?: string;
  statusCode?: number;
  responseBody?: string;
  data?: unknown;
  isRetryable?: boolean;
}): APICallError {
  return new APICallError({
    message: options.message ?? "provider call failed",
    url: "https://example.test/v1/chat/completions",
    requestBodyValues: {},
    statusCode: options.statusCode,
    responseBody: options.responseBody,
    data: options.data,
    isRetryable: options.isRetryable,
  });
}

const LITERALS: Array<[string, string]> = [
  ["rate limit reached for requests", "rate_limit"],
  ["you exceeded your current quota", "rate_limit"],
  ["this model's maximum context length is 8192", "context_overflow"],
  ["context_length_exceeded", "context_overflow"],
  ["context window exceeded", "context_overflow"],
  ["too many tokens in the request", "context_overflow"],
  ["maximum context reached", "context_overflow"],
  ["prompt is too long", "context_overflow"],
  ["input is too long for this model", "context_overflow"],
  ["input length exceeds the limit", "context_overflow"],
  ["num_ctx is smaller than the prompt", "context_overflow"],
  ["max output tokens reached", "output_limit"],
  ["maximum output tokens exceeded", "output_limit"],
  ["max completion tokens exceeded", "output_limit"],
  ["request blocked by moderation", "moderation"],
  ["blocked by content policy", "moderation"],
  ["request timeout", "transient"],
  ["read econnreset", "transient"],
  ["connect econnrefused 127.0.0.1:11434", "transient"],
  ["connect etimedout", "transient"],
  ["socket hang up", "transient"],
  ["fetch failed", "transient"],
  ["network is unreachable", "transient"],
];

describe("типизированная классификация ошибок", () => {
  it("сохраняет разбор по текстовым признакам как запасной путь", () => {
    const failover = createFailover();
    for (const [message, expected] of LITERALS) {
      expect(failover.classify(new Error(message)), message).toBe(expected);
    }
  });

  it("оставляет fatal для нераспознанного текста", () => {
    const failover = createFailover();
    expect(failover.classify(new Error("что-то пошло не так"))).toBe("fatal");
    expect(failover.classify("строка без признаков")).toBe("fatal");
    expect(failover.classify(undefined)).toBe("fatal");
  });

  it("читает статус из типизированной ошибки SDK", () => {
    const failover = createFailover();
    expect(failover.classify(apiError({ statusCode: 429 }))).toBe("rate_limit");
    expect(failover.classify(apiError({ statusCode: 401 }))).toBe("auth");
    expect(failover.classify(apiError({ statusCode: 403 }))).toBe("auth");
    expect(failover.classify(apiError({ statusCode: 502 }))).toBe("transient");
  });

  it("не спрашивает текст, если статус уже всё сказал", () => {
    const failover = createFailover();
    const quoted = apiError({
      statusCode: 429,
      message: "модель ответила про context length",
      responseBody: '{"error":{"message":"maximum context length is 8192"}}',
    });
    expect(failover.classify(quoted)).toBe("rate_limit");
  });

  it("распознаёт переполнение контекста по коду провайдера без англоязычного текста", () => {
    const failover = createFailover();
    const russian = apiError({
      statusCode: 400,
      message: "Превышен размер запроса для этой модели",
      responseBody:
        '{"error":{"message":"Превышен размер запроса","type":"invalid_request_error","code":"context_length_exceeded"}}',
    });
    expect(failover.classify(russian)).toBe("context_overflow");

    const structured = apiError({
      statusCode: 400,
      message: "Слишком длинный запрос",
      data: { error: { code: "context_length_exceeded" } },
    });
    expect(failover.classify(structured)).toBe("context_overflow");
  });

  it("распознаёт перегрузку и модерацию по коду провайдера", () => {
    const failover = createFailover();
    expect(
      failover.classify(
        apiError({
          statusCode: 400,
          message: "Сервис занят",
          responseBody: '{"type":"error","error":{"type":"overloaded_error"}}',
        }),
      ),
    ).toBe("transient");
    expect(
      failover.classify(
        apiError({
          statusCode: 400,
          message: "Запрос отклонён",
          responseBody: '{"error":{"code":"content_filter"}}',
        }),
      ),
    ).toBe("moderation");
  });

  it("учитывает признак повторяемости из SDK", () => {
    const failover = createFailover();
    expect(
      failover.classify(
        apiError({ message: "провайдер недоступен", isRetryable: true }),
      ),
    ).toBe("transient");
    expect(
      failover.classify(
        apiError({ message: "провайдер отказал", isRetryable: false }),
      ),
    ).toBe("fatal");
  });

  it("классифицирует типизированные ошибки ключа и возможностей", () => {
    const failover = createFailover();
    expect(
      failover.classify(new LoadAPIKeyError({ message: "нет ключа" })),
    ).toBe("auth");
  });

  it("разворачивает RetryError и обёртки cause", () => {
    const failover = createFailover();
    const inner = apiError({ statusCode: 429, message: "перегрузка" });
    expect(
      failover.classify(
        new RetryError({
          message: "не удалось после трёх попыток",
          reason: "maxRetriesExceeded",
          errors: [inner],
        }),
      ),
    ).toBe("rate_limit");

    const wrapped = new Error("Ошибка генерации", { cause: inner });
    expect(failover.classify(wrapped)).toBe("rate_limit");
  });

  it("не считает переполнением контекста упоминание фразы в теле ответа", () => {
    const failover = createFailover();
    const echoed = apiError({
      statusCode: 400,
      message: "Ошибка запроса",
      responseBody:
        '{"error":{"message":"the user asked about context length limits","code":"invalid_api_key"}}',
    });
    expect(failover.classify(echoed)).toBe("auth");
  });
});
