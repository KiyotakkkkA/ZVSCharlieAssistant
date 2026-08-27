import { describe, expect, it } from "vitest";
import { ModelFailover } from "../../src/host/infrastructure/text-generation/model-failover";
import type { ChatRepository } from "../../src/host/infrastructure/database/chat.repository";
import type { ProviderRegistry } from "../../src/host/infrastructure/text-generation/provider.registry";

const MODELS = [
  { id: "small", contextLength: 8_000, maxCompletionTokens: 1_000 },
  { id: "large", contextLength: 128_000, maxCompletionTokens: 8_000 },
  { id: "mid", contextLength: 32_000, maxCompletionTokens: 4_000 },
];

function createFailover() {
  const data = {
    listEnabledTextModels: () => MODELS,
    recordModelSwitch: () => undefined,
  } as unknown as ChatRepository;
  const providers = {
    modelInfo: (id: string) => ({
      contextLength:
        MODELS.find((model) => model.id === id)?.contextLength ?? 0,
    }),
    generationSettings: (id: string) => ({
      maxOutputTokens:
        MODELS.find((model) => model.id === id)?.maxCompletionTokens ?? 0,
    }),
  } as unknown as ProviderRegistry;
  return new ModelFailover(data, providers);
}

function httpError(status: number, message = "ошибка"): Error {
  return Object.assign(new Error(message), { statusCode: status });
}

describe("классификация отказов провайдера", () => {
  it("различает классы ошибок", () => {
    const failover = createFailover();
    expect(failover.classify(httpError(503))).toBe("transient");
    expect(failover.classify(httpError(429))).toBe("rate_limit");
    expect(failover.classify(httpError(401))).toBe("auth");
    expect(failover.classify(new Error("socket hang up"))).toBe("transient");
    expect(
      failover.classify(
        new Error("This model's maximum context length is 8192"),
      ),
    ).toBe("context_overflow");
    expect(
      failover.classify(
        Object.assign(new Error("Bad request"), {
          responseBody: '{"error":"context window exceeded"}',
        }),
      ),
    ).toBe("context_overflow");
    expect(failover.classify(new Error("max output tokens reached"))).toBe(
      "output_limit",
    );
    expect(failover.classify(new Error("blocked by content policy"))).toBe(
      "moderation",
    );
  });

  it("сначала повторяет на той же модели, потом переключается", () => {
    const failover = createFailover();
    const first = failover.decide(httpError(503), {
      activeModelId: "small",
      attempt: 0,
      compacted: false,
    });
    expect(first.kind).toBe("retry");

    const exhausted = failover.decide(httpError(503), {
      activeModelId: "small",
      attempt: 2,
      compacted: false,
    });
    expect(exhausted.kind).toBe("switch");
    if (exhausted.kind === "switch") {
      expect(exhausted.modelId).not.toBe("small");
      expect(exhausted.reason).toBe("provider_error");
    }
  });

  it("на лимите переключается без повторов", () => {
    const failover = createFailover();
    const decision = failover.decide(httpError(429), {
      activeModelId: "small",
      attempt: 0,
      compacted: false,
    });
    expect(decision.kind).toBe("switch");
    if (decision.kind === "switch") expect(decision.reason).toBe("rate_limit");
  });

  it("на переполнении контекста сначала сжимает, затем берёт модель шире", () => {
    const failover = createFailover();
    const overflow = new Error("maximum context length exceeded");

    expect(
      failover.decide(overflow, {
        activeModelId: "small",
        attempt: 0,
        compacted: false,
      }).kind,
    ).toBe("compact");

    const afterCompaction = failover.decide(overflow, {
      activeModelId: "small",
      attempt: 0,
      compacted: true,
    });
    expect(afterCompaction.kind).toBe("switch");
    if (afterCompaction.kind === "switch") {
      expect(afterCompaction.modelId).toBe("large");
      expect(afterCompaction.reason).toBe("context_overflow");
    }
  });

  it("не переключается на модерации", () => {
    const failover = createFailover();
    expect(
      failover.decide(new Error("content policy violation"), {
        activeModelId: "small",
        attempt: 0,
        compacted: false,
      }).kind,
    ).toBe("fail");
  });

  it("не возвращается на модель, помеченную нездоровой", () => {
    const failover = createFailover();
    failover.markDegraded("large");
    expect(failover.isDegraded("large")).toBe(true);
    expect(failover.chain("small")).not.toContain("large");
  });

  it("для превышенного вывода выбирает модель с большим лимитом ответа", () => {
    const failover = createFailover();
    expect(failover.widerOutputModel("small")).toBe("large");
    expect(failover.widerOutputModel("large")).toBeUndefined();
    expect(failover.widerContextModel("small")).toBe("large");

    const decision = failover.decide(new Error("max output tokens reached"), {
      activeModelId: "small",
      attempt: 0,
      compacted: false,
    });
    expect(decision).toMatchObject({
      kind: "switch",
      modelId: "large",
      reason: "output_limit",
    });
  });
});
