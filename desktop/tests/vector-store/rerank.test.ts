import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VectorStoreService } from "../../src/host/infrastructure/vector-store/vector-store.service";
import type {
  NativeRerankResult,
  NativeVectorSearchResult,
} from "../../src/host/infrastructure/vector-store/native-indexer.service";

let directory: string | undefined;

function createDirectory() {
  directory = mkdtempSync(join(tmpdir(), "zvs-rerank-"));
  return directory;
}

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

function row(documentId: string, score: number): NativeVectorSearchResult {
  return {
    documentId,
    fileName: `${documentId}.pdf`,
    chunkIndex: 0,
    text: `фрагмент ${documentId}`,
    pageNumber: 1,
    headingPath: "",
    score,
  };
}

function createService(options: {
  rows: NativeVectorSearchResult[];
  available: boolean;
  rerank?: (
    query: string,
    passages: string[],
  ) => Promise<NativeRerankResult> | never;
}) {
  const data = {
    store: (id: string) => ({
      id,
      name: id,
      embeddingModelId: "embedding-1",
      status: "ready",
      searchMode: "vector" as const,
    }),
  };
  const rerank = vi.fn(
    options.rerank ?? (async () => ({ scores: [] }) as never),
  );
  const indexer = {
    rerankAvailable: () => options.available,
    rerank,
    searchVectorIndex: vi.fn(async () => options.rows),
  };
  const service = new VectorStoreService(
    data as never,
    { embed: vi.fn(async () => [[0.1]]) } as never,
    createDirectory(),
    indexer as never,
  );
  return { service, rerank };
}

const ids = (results: Array<{ documentId: string }>) =>
  results.map((item) => item.documentId);

const search = (service: VectorStoreService, limit = 3) =>
  service.search({ vectorStoreIds: ["s"], query: "кто оплатил", limit });

describe("переоценка результатов", () => {
  it("переупорядочивает выдачу по оценке модели и возвращает её как score", async () => {
    const { service, rerank } = createService({
      available: true,
      rows: [row("a", 0.9), row("b", 0.8), row("c", 0.7)],
      rerank: async () => ({
        scores: [0.1, 0.95, 0.4],
        provider: "cpu",
        accelerationError: null,
      }),
    });

    const results = await search(service);

    expect(ids(results)).toEqual(["b", "c", "a"]);
    expect(results.map((item) => item.score)).toEqual([0.95, 0.4, 0.1]);
    expect(rerank).toHaveBeenCalledWith("кто оплатил", [
      "фрагмент a",
      "фрагмент b",
      "фрагмент c",
    ]);
  });

  it("не обращается к модели, когда она не загружена", async () => {
    const { service, rerank } = createService({
      available: false,
      rows: [row("a", 0.9), row("b", 0.8)],
    });

    const results = await search(service);

    expect(rerank).not.toHaveBeenCalled();
    expect(ids(results)).toEqual(["a", "b"]);
    expect(service.rerankDiagnostics()).toEqual({
      available: false,
      error: null,
    });
  });

  it("падает обратно на слияние по рангу, когда модель не загрузилась", async () => {
    const { service } = createService({
      available: true,
      rows: [row("a", 0.9), row("b", 0.8)],
      rerank: async () => {
        throw new Error("Не удалось загрузить словарь модели");
      },
    });

    const results = await search(service);

    expect(ids(results)).toEqual(["a", "b"]);
    expect(service.rerankDiagnostics().error).toBe(
      "Не удалось загрузить словарь модели",
    );
  });

  it("падает обратно, когда модель вернула не столько оценок", async () => {
    const { service } = createService({
      available: true,
      rows: [row("a", 0.9), row("b", 0.8)],
      rerank: async () => ({
        scores: [0.5],
        provider: "cpu",
        accelerationError: null,
      }),
    });

    const results = await search(service);

    expect(ids(results)).toEqual(["a", "b"]);
    expect(service.rerankDiagnostics().error).toContain(
      "неожиданный результат",
    );
  });

  it("сообщает об ошибке ускорения, не отменяя переоценку", async () => {
    const { service } = createService({
      available: true,
      rows: [row("a", 0.9), row("b", 0.8)],
      rerank: async () => ({
        scores: [0.2, 0.7],
        provider: "cpu",
        accelerationError: "CUDA недоступна",
      }),
    });

    const results = await search(service);

    expect(ids(results)).toEqual(["b", "a"]);
    expect(service.rerankDiagnostics().error).toBe("CUDA недоступна");
  });

  it("не вызывает модель для единственного кандидата", async () => {
    const { service, rerank } = createService({
      available: true,
      rows: [row("a", 0.9)],
    });

    const results = await search(service);

    expect(rerank).not.toHaveBeenCalled();
    expect(ids(results)).toEqual(["a"]);
  });
});
