import { describe, expect, it, vi } from "vitest";
import { VectorStoreService } from "../../src/host/infrastructure/vector-store/vector-store.service";

function createService() {
  let index = 0;
  const data = {
    store: (id: string) => ({ id, embeddingModelId: "embedding-1" }),
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
    {
      stopIndexing: vi.fn(),
      resumeIndexing: vi.fn(),
      finalizeVectorIndex: vi.fn(async () => undefined),
    } as never,
  );
  return { service, data };
}

function uploads(count: number) {
  return Array.from({ length: count }, (_, item) => ({
    vectorStoreId: "store-1",
    fileName: `document-${item}.pdf`,
    mimeType: "application/pdf",
    data: new TextEncoder().encode(`content-${item}`).buffer,
  }));
}

describe("VectorStoreService progress and cancellation", () => {
  it("tracks completion and estimates the remaining time", async () => {
    const { service } = createService();
    const releases: Array<(failed: boolean) => void> = [];
    const internal = service as unknown as { ingest: () => Promise<boolean> };
    vi.spyOn(internal, "ingest").mockImplementation(
      () => new Promise<boolean>((resolve) => releases.push(resolve)),
    );

    await service.upload(uploads(4));

    const initial = service.progress("store-1");
    expect(initial).toMatchObject({ total: 4, completed: 0, active: 2 });
    expect(initial?.etaMs).toBeNull();

    releases.shift()?.(false);
    await vi.waitFor(() =>
      expect(service.progress("store-1")?.completed).toBe(1),
    );

    const running = service.progress("store-1");
    expect(running?.remaining).toBe(3);
    expect(running?.averageMs).not.toBeNull();
    expect(running?.etaMs).not.toBeNull();

    await vi.waitFor(() => {
      while (releases.length) releases.shift()?.(false);
      expect(service.progress("store-1")).toBeNull();
    });
  });

  it("counts failures separately from completions", async () => {
    const { service } = createService();
    const releases: Array<(failed: boolean) => void> = [];
    const internal = service as unknown as { ingest: () => Promise<boolean> };
    vi.spyOn(internal, "ingest").mockImplementation(
      () => new Promise<boolean>((resolve) => releases.push(resolve)),
    );

    await service.upload(uploads(2));
    releases.shift()?.(true);
    releases.shift()?.(false);

    await vi.waitFor(() => expect(service.progress("store-1")).toBeNull());
  });

  it("stops every store queue and resumes the preserved work", async () => {
    const { service, data } = createService();
    const releases: Array<(outcome: "succeeded" | "paused") => void> = [];
    let started = 0;
    const internal = service as unknown as {
      ingest: () => Promise<"succeeded" | "paused">;
    };
    vi.spyOn(internal, "ingest").mockImplementation(
      () =>
        new Promise((resolve) => {
          started += 1;
          releases.push(resolve);
        }),
    );

    await service.upload([
      ...uploads(2),
      ...uploads(2).map((item) => ({ ...item, vectorStoreId: "store-2" })),
    ]);
    expect(started).toBe(2);

    service.stopIndexing();

    expect(data.updateDocument).not.toHaveBeenCalled();
    expect(service.progress("store-1")?.paused).toBe(true);
    expect(service.progress("store-2")?.paused).toBe(true);

    releases.shift()?.("paused");
    releases.shift()?.("paused");
    await vi.waitFor(() => {
      expect(service.progress("store-1")?.active ?? 0).toBe(0);
      expect(service.progress("store-2")?.active ?? 0).toBe(0);
    });

    service.resumeIndexing();
    await vi.waitFor(() => expect(started).toBe(4));
    await vi.waitFor(() => {
      while (releases.length) releases.shift()?.("succeeded");
      expect(service.progress("store-1")).toBeNull();
      expect(service.progress("store-2")).toBeNull();
    });
  });

  it("reports no progress for a store that never started", () => {
    const { service } = createService();
    expect(service.progress("store-1")).toBeNull();
  });
});
