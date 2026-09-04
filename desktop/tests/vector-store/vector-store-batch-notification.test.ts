import { describe, expect, it, vi } from "vitest";
import {
  VectorStoreService,
  type IngestBatchResult,
} from "../../src/host/infrastructure/vector-store/vector-store.service";

function createService() {
  let index = 0;
  const events: IngestBatchResult[] = [];
  const data = {
    store: () => ({
      id: "store-1",
      name: "Методики",
      embeddingModelId: "embedding-1",
      searchMode: "vector",
    }),
    embeddingModel: () => true,
    documentByHash: () => undefined,
    createDocument: vi.fn(() => `document-${++index}`),
    updateDocument: vi.fn(),
    setStoreState: vi.fn(),
    refreshStoreState: vi.fn(),
    snapshot: vi.fn(() => ({ stores: [], documents: [] })),
  };
  const service = new VectorStoreService(
    data as never,
    {} as never,
    "files",
    { finalizeVectorIndex: vi.fn(async () => undefined) } as never,
    (event) => events.push(event),
  );
  return { service, events };
}

function uploads(count: number) {
  return Array.from({ length: count }, (_, item) => ({
    vectorStoreId: "store-1",
    fileName: `document-${item}.pdf`,
    mimeType: "application/pdf",
    data: new TextEncoder().encode(`content-${item}`).buffer,
  }));
}

describe("VectorStoreService batch notification", () => {
  it("reports once for the whole task, not once per document", async () => {
    const { service, events } = createService();
    const releases: Array<(outcome: "succeeded" | "failed") => void> = [];
    const internal = service as unknown as { ingest: () => Promise<"succeeded" | "failed"> };
    vi.spyOn(internal, "ingest").mockImplementation(
      () => new Promise((resolve) => releases.push(resolve)),
    );

    await service.upload(uploads(5));
    await vi.waitFor(() => {
      while (releases.length) releases.shift()?.("succeeded");
      expect(service.progress("store-1")).toBeNull();
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      storeId: "store-1",
      storeName: "Методики",
      total: 5,
      succeeded: 5,
      failed: 0,
      cancelled: false,
    });
  });

  it("counts the documents that failed inside the task", async () => {
    const { service, events } = createService();
    const releases: Array<(outcome: "succeeded" | "failed") => void> = [];
    const internal = service as unknown as { ingest: () => Promise<"succeeded" | "failed"> };
    vi.spyOn(internal, "ingest").mockImplementation(
      () => new Promise((resolve) => releases.push(resolve)),
    );

    await service.upload(uploads(3));
    await vi.waitFor(() => {
      while (releases.length)
        releases.shift()?.(releases.length === 0 ? "failed" : "succeeded");
      expect(service.progress("store-1")).toBeNull();
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.total).toBe(3);
    expect(events[0]!.succeeded + events[0]!.failed).toBe(3);
  });

  it("says nothing until every document in the task is done", async () => {
    const { service, events } = createService();
    const releases: Array<(outcome: "succeeded" | "failed") => void> = [];
    const internal = service as unknown as { ingest: () => Promise<"succeeded" | "failed"> };
    vi.spyOn(internal, "ingest").mockImplementation(
      () => new Promise((resolve) => releases.push(resolve)),
    );

    await service.upload(uploads(4));
    releases.shift()?.("succeeded");
    await vi.waitFor(() =>
      expect(service.progress("store-1")?.completed).toBe(1),
    );

    expect(events).toHaveLength(0);
  });
});
