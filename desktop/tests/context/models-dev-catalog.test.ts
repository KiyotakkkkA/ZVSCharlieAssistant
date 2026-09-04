import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModelsDevCatalog } from "../../src/host/infrastructure/text-generation/models-dev.catalog";

const PAYLOAD = {
  openrouter: {
    id: "openrouter",
    doc: "https://openrouter.ai/models",
    models: {
      "acme/reasoner-large": {
        id: "acme/reasoner-large",
        name: "Reasoner Large",
        description: "Каталожное описание",
        family: "reasoner",
        attachment: true,
        reasoning: true,
        tool_call: true,
        structured_output: true,
        knowledge: "2025-03",
        release_date: "2025-04-01",
        last_updated: "2025-06-01",
        open_weights: false,
        modalities: { input: ["text", "image"], output: ["text"] },
        limit: { context: 400000, output: 64000 },
        cost: { input: 3, output: 15, cache_read: 0.3 },
      },
    },
  },
  "ollama-cloud": {
    id: "ollama-cloud",
    models: {
      "gpt-oss:20b": {
        id: "gpt-oss:20b",
        name: "GPT OSS 20B",
        attachment: false,
        reasoning: true,
        tool_call: true,
        open_weights: true,
        modalities: { input: ["text"], output: ["text"] },
        limit: { context: 131072, output: 32768 },
      },
    },
  },
  fireworks: {
    id: "fireworks",
    models: {
      "qwen3-8b": {
        id: "qwen3-8b",
        name: "Qwen3 8B",
        attachment: false,
        reasoning: true,
        tool_call: true,
        open_weights: true,
        modalities: { input: ["text"], output: ["text"] },
        limit: { context: 262144, output: 32768 },
      },
    },
  },
};

async function catalogWithCache(): Promise<ModelsDevCatalog> {
  const directory = await mkdtemp(join(tmpdir(), "zvs-models-dev-"));
  const file = join(directory, "catalog.json");
  await writeFile(
    file,
    JSON.stringify({ etag: null, fetchedAt: Date.now(), payload: PAYLOAD }),
    "utf8",
  );
  return new ModelsDevCatalog(file);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("каталог models.dev", () => {
  it("берёт свежий кэш с диска и не ходит в сеть", async () => {
    const request = vi.spyOn(globalThis, "fetch");
    const catalog = await catalogWithCache();

    const entries = await catalog.entriesFor("openrouter", [
      "acme/reasoner-large",
    ]);

    expect(request).not.toHaveBeenCalled();
    const entry = entries.get("acme/reasoner-large");
    expect(entry?.contextLength).toBe(400000);
    expect(entry?.maxCompletionTokens).toBe(64000);
    expect(entry?.promptPrice).toBe("0.000003");
    expect(entry?.completionPrice).toBe("0.000015");
    expect(entry?.supportsVision).toBe(true);
    expect(entry?.knowledgeCutoff).toBe("2025-03");
    expect(entry?.catalogUrl).toBe("https://openrouter.ai/models");
  });

  it("сопоставляет модель OpenRouter, у которой в id есть суффикс варианта", async () => {
    const catalog = await catalogWithCache();

    const entries = await catalog.entriesFor("openrouter", [
      "acme/reasoner-large:free",
    ]);

    expect(entries.get("acme/reasoner-large:free")?.contextLength).toBe(400000);
  });

  it("находит локальную модель Ollama среди моделей с открытыми весами", async () => {
    const catalog = await catalogWithCache();

    const entries = await catalog.entriesFor("ollama", [
      "gpt-oss:20b",
      "qwen3:8b",
    ]);

    expect(entries.get("gpt-oss:20b")?.contextLength).toBe(131072);
    expect(entries.get("qwen3:8b")?.contextLength).toBe(262144);
    expect(entries.get("qwen3:8b")?.openWeights).toBe(true);
  });

  it("не подставляет чужие модели провайдерам с закрытым каталогом", async () => {
    const catalog = await catalogWithCache();

    const entries = await catalog.entriesFor("mistral", ["qwen3:8b"]);

    expect(entries.size).toBe(0);
  });

  it("возвращает пустой результат, когда нет ни кэша, ни сети", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const directory = await mkdtemp(join(tmpdir(), "zvs-models-dev-"));
    const catalog = new ModelsDevCatalog(join(directory, "missing.json"));

    await expect(
      catalog.entriesFor("openrouter", ["acme/reasoner-large"]),
    ).resolves.toEqual(new Map());
  });
});
