import { afterEach, describe, expect, it, vi } from "vitest";
import type { VectorStoreSnapshot } from "../../src/ipc/contracts";
import { VectorStoreStore } from "../../src/renderer/stores/VectorStoreStore";

const storeModel = {
  id: "store-1",
  name: "Документы",
  description: "",
  embeddingModelId: "embedding-1",
  status: "indexing" as const,
  searchMode: "vector" as const,
  chunkSizeTokens: 700,
  chunkOverlapTokens: 100,
  vectorDimension: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const queuedDocument = {
  id: "document-1",
  vectorStoreId: "store-1",
  fileName: "document.pdf",
  mimeType: "application/pdf",
  size: 100,
  status: "queued" as const,
  progress: 0,
  chunkCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  errorMessage: null,
};

describe("VectorStoreStore processing recovery", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("resumes polling unfinished documents after bootstrap", async () => {
    vi.useFakeTimers();
    const initial: VectorStoreSnapshot = {
      stores: [storeModel],
      documents: [queuedDocument],
    };
    const ready: VectorStoreSnapshot = {
      stores: [{ ...storeModel, status: "ready" }],
      documents: [
        { ...queuedDocument, status: "ready", progress: 100, chunkCount: 3 },
      ],
    };
    const getSnapshot = vi
      .fn<() => Promise<VectorStoreSnapshot>>()
      .mockResolvedValueOnce(initial)
      .mockResolvedValue(ready);
    const getDocuments = vi.fn().mockResolvedValue(ready.documents);
    const getIndexingCapabilities = vi.fn().mockResolvedValue({
      cudaAvailable: false,
      deviceName: null,
      vramMb: null,
      driverVersion: null,
      unavailableReason: "NVIDIA GPU не обнаружены",
      preference: "auto" as const,
    });
    vi.stubGlobal("window", {
      desktop: {
        vectorStores: { getSnapshot, getDocuments, getIndexingCapabilities },
      },
    });
    const store = new VectorStoreStore();

    await store.bootstrap();
    expect(store.processingDocuments("store-1")).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() =>
      expect(store.processingDocuments("store-1")).toHaveLength(0),
    );
    expect(getDocuments).toHaveBeenCalledWith(["document-1"]);
    expect(store.stores[0]?.status).toBe("ready");
  });
});
