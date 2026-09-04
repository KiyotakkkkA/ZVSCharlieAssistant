import { describe, expect, it, vi } from "vitest";
import { VectorStoreService } from "../../src/host/infrastructure/vector-store/vector-store.service";
import type { NativeVectorSearchResult } from "../../src/host/infrastructure/vector-store/native-indexer.service";

type StoreShape = {
  searchMode: "vector" | "hybrid";
  rows: NativeVectorSearchResult[];
};

function row(
  documentId: string,
  score: number,
  chunkIndex = 0,
): NativeVectorSearchResult {
  return {
    documentId,
    fileName: `${documentId}.pdf`,
    chunkIndex,
    text: `фрагмент ${documentId}`,
    pageNumber: 1,
    headingPath: "",
    score,
  };
}

function createService(stores: Record<string, StoreShape>) {
  const requested: Array<{ storeId: string; limit: number }> = [];
  const data = {
    store: (id: string) =>
      stores[id]
        ? {
            id,
            name: id,
            embeddingModelId: "embedding-1",
            status: "ready",
            searchMode: stores[id]!.searchMode,
          }
        : undefined,
  };
  const embeddings = { embed: vi.fn(async () => [[0.1, 0.2]]) };
  const indexer = {
    rerankAvailable: () => false,
    searchVectorIndex: vi.fn(
      async (
        storeId: string,
        _query: string,
        _vector: number[],
        _mode: string,
        limit: number,
      ) => {
        requested.push({ storeId, limit });
        return stores[storeId]!.rows.slice(0, limit);
      },
    ),
  };
  const service = new VectorStoreService(
    data as never,
    embeddings as never,
    "files",
    indexer as never,
  );
  return { service, requested };
}

const ids = (results: Array<{ documentId: string }>) =>
  results.map((item) => item.documentId);

describe("слияние результатов поиска по рангу", () => {
  it("объединяет хранилища с разными режимами поиска детерминированно", async () => {
    const { service } = createService({
      "store-vector": {
        searchMode: "vector",
        rows: [row("v1", 0.52), row("shared", 0.51), row("v2", 0.5)],
      },
      "store-hybrid": {
        searchMode: "hybrid",
        rows: [row("h1", 0.99), row("shared", 0.98), row("h2", 0.97)],
      },
    });

    const results = await service.search({
      vectorStoreIds: ["store-vector", "store-hybrid"],
      query: "иск",
      limit: 5,
    });

    expect(ids(results)[0]).toBe("shared");
    expect(new Set(ids(results))).toEqual(
      new Set(["shared", "v1", "h1", "v2", "h2"]),
    );

    const repeated = await service.search({
      vectorStoreIds: ["store-vector", "store-hybrid"],
      query: "иск",
      limit: 5,
    });
    expect(ids(repeated)).toEqual(ids(results));
  });

  it("не даёт хранилищу с большими абсолютными оценками вытеснить другое", async () => {
    const { service } = createService({
      low: {
        searchMode: "vector",
        rows: [row("low1", 0.31), row("low2", 0.3)],
      },
      high: {
        searchMode: "hybrid",
        rows: [row("high1", 0.99), row("high2", 0.98)],
      },
    });

    const results = await service.search({
      vectorStoreIds: ["low", "high"],
      query: "иск",
      limit: 2,
    });

    expect(ids(results)).toEqual(["low1", "high1"]);
  });

  it("сохраняет исходный порядок при поиске по одному хранилищу", async () => {
    const rows = [
      row("a", 0.9),
      row("b", 0.8),
      row("c", 0.7),
      row("d", 0.6),
      row("e", 0.5),
    ];
    const { service } = createService({
      only: { searchMode: "vector", rows },
    });

    const results = await service.search({
      vectorStoreIds: ["only"],
      query: "иск",
      limit: 5,
    });

    expect(ids(results)).toEqual(["a", "b", "c", "d", "e"]);
    expect(results.map((item) => item.score)).toEqual([
      0.9, 0.8, 0.7, 0.6, 0.5,
    ]);
  });

  it("запрашивает с запасом и поднимает документ, слабый в одном хранилище", async () => {
    const weakThenStrong = "переходящий";
    const { service, requested } = createService({
      first: {
        searchMode: "vector",
        rows: [
          row("f1", 0.9),
          row("f2", 0.89),
          row("f3", 0.88),
          row("f4", 0.87),
          row("f5", 0.86),
          row(weakThenStrong, 0.85),
        ],
      },
      second: {
        searchMode: "hybrid",
        rows: [row(weakThenStrong, 0.99), row("s2", 0.5)],
      },
    });

    const results = await service.search({
      vectorStoreIds: ["first", "second"],
      query: "иск",
      limit: 2,
    });

    expect(requested.every((entry) => entry.limit === 6)).toBe(true);
    expect(ids(results)[0]).toBe(weakThenStrong);
  });

  it("не выходит за максимум в 20 при большом лимите", async () => {
    const { service, requested } = createService({
      only: { searchMode: "vector", rows: [row("a", 0.9)] },
    });

    await service.search({
      vectorStoreIds: ["only"],
      query: "иск",
      limit: 20,
    });

    expect(requested[0]!.limit).toBe(20);
  });

  it("применяет порог внутри хранилища до слияния", async () => {
    const { service } = createService({
      only: {
        searchMode: "vector",
        rows: [row("a", 0.9), row("b", 0.4), row("c", 0.2)],
      },
    });

    const results = await service.search({
      vectorStoreIds: ["only"],
      query: "иск",
      limit: 5,
      scoreThreshold: 0.5,
    });

    expect(ids(results)).toEqual(["a"]);
  });
});
