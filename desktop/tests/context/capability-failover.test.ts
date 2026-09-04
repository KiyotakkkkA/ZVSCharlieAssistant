import { describe, expect, it, vi } from "vitest";
import {
  ModelFailover,
  type ModelDirectory,
} from "../../src/host/infrastructure/text-generation/model-failover";
import type { ProviderRegistry } from "../../src/host/infrastructure/text-generation/provider.registry";

interface FakeModel {
  id: string;
  contextLength: number;
  maxCompletionTokens?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
}

function createFailover(models: FakeModel[]) {
  const directory: ModelDirectory = {
    listEnabledTextModels: () =>
      models.map((model) => ({
        id: model.id,
        kind: "openrouter",
        contextLength: model.contextLength,
        maxCompletionTokens: model.maxCompletionTokens ?? 4096,
      })),
    recordModelSwitch: vi.fn(),
  };
  const providers = {
    modelInfo: (modelId: string) => {
      const model = models.find((item) => item.id === modelId);
      if (!model) throw new Error("Модель отключена или не найдена");
      return {
        modelId: model.id,
        remoteId: model.id,
        kind: "openrouter",
        contextLength: model.contextLength,
        maxCompletionTokens: model.maxCompletionTokens ?? 4096,
        promptPricePerToken: 0,
        completionPricePerToken: 0,
        supportsTools: model.supportsTools,
        supportsStructuredOutput: undefined,
        supportsVision: model.supportsVision,
        supportsReasoning: undefined,
      };
    },
    generationSettings: () => ({
      maxOutputTokens: 4096,
      temperature: 0.7,
      topP: 0.9,
    }),
  } as unknown as ProviderRegistry;
  return new ModelFailover(directory, providers);
}

const rateLimit = Object.assign(new Error("rate limit"), { status: 429 });

describe("подбор модели с учётом возможностей", () => {
  it("не переключается на модель без поддержки инструментов", () => {
    const failover = createFailover([
      { id: "primary", contextLength: 8_000, supportsTools: true },
      { id: "huge-no-tools", contextLength: 900_000, supportsTools: false },
      { id: "small-tools", contextLength: 16_000, supportsTools: true },
    ]);

    const decision = failover.decide(rateLimit, {
      activeModelId: "primary",
      attempt: 0,
      compacted: false,
      requires: { tools: true },
    });

    expect(decision).toMatchObject({ kind: "switch", modelId: "small-tools" });
  });

  it("проваливается, когда ни одна модель не умеет вызывать инструменты", () => {
    const failover = createFailover([
      { id: "primary", contextLength: 8_000, supportsTools: true },
      { id: "other", contextLength: 900_000, supportsTools: false },
    ]);

    const decision = failover.decide(rateLimit, {
      activeModelId: "primary",
      attempt: 0,
      compacted: false,
      requires: { tools: true },
    });

    expect(decision.kind).toBe("fail");
    expect((decision as { message?: string }).message).toContain(
      "вызов инструментов",
    );
  });

  it("допускает модель с неизвестными возможностями, но ставит её ниже", () => {
    const failover = createFailover([
      { id: "primary", contextLength: 8_000, supportsTools: true },
      { id: "unknown", contextLength: 900_000 },
      { id: "known", contextLength: 16_000, supportsTools: true },
    ]);

    expect(failover.chain("primary", { tools: true })).toEqual([
      "primary",
      "known",
      "unknown",
    ]);
  });

  it("оставляет неизвестную модель пригодной, когда известных нет", () => {
    const failover = createFailover([
      { id: "primary", contextLength: 8_000, supportsTools: true },
      { id: "unknown", contextLength: 32_000 },
    ]);

    const decision = failover.decide(rateLimit, {
      activeModelId: "primary",
      attempt: 0,
      compacted: false,
      requires: { tools: true },
    });

    expect(decision).toMatchObject({ kind: "switch", modelId: "unknown" });
  });

  it("не меняет выбор, когда инструменты не нужны", () => {
    const models: FakeModel[] = [
      { id: "primary", contextLength: 8_000, supportsTools: true },
      { id: "huge-no-tools", contextLength: 900_000, supportsTools: false },
      { id: "small-tools", contextLength: 16_000, supportsTools: true },
    ];

    expect(createFailover(models).chain("primary")).toEqual([
      "primary",
      "huge-no-tools",
      "small-tools",
    ]);

    const decision = createFailover(models).decide(rateLimit, {
      activeModelId: "primary",
      attempt: 0,
      compacted: false,
    });
    expect(decision).toMatchObject({
      kind: "switch",
      modelId: "huge-no-tools",
    });
  });

  it("учитывает требования при расширении контекста", () => {
    const failover = createFailover([
      { id: "primary", contextLength: 8_000, supportsTools: true },
      { id: "wide-no-tools", contextLength: 900_000, supportsTools: false },
      { id: "wide-tools", contextLength: 32_000, supportsTools: true },
    ]);

    const decision = failover.decide(new Error("maximum context length"), {
      activeModelId: "primary",
      attempt: 0,
      compacted: true,
      requires: { tools: true },
    });

    expect(decision).toMatchObject({ kind: "switch", modelId: "wide-tools" });
  });

  it("записывает требования в причину переключения", () => {
    const failover = createFailover([
      { id: "primary", contextLength: 8_000, supportsTools: true },
      { id: "other", contextLength: 16_000, supportsTools: true },
    ]);

    const decision = failover.decide(rateLimit, {
      activeModelId: "primary",
      attempt: 0,
      compacted: false,
      requires: { tools: true, vision: true },
    });

    expect((decision as { required?: string[] }).required).toEqual([
      "tools",
      "vision",
    ]);
  });
});
