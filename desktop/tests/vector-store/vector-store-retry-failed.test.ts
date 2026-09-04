import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VectorStoreService } from "../../src/host/infrastructure/vector-store/vector-store.service";

let directory: string | undefined;

function createDirectory() {
  directory = mkdtempSync(join(tmpdir(), "zvs-retry-"));
  return directory;
}

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

function createService(failed: Array<Record<string, string>>) {
  const data = {
    store: () => ({ id: "store-1", embeddingModelId: "embedding-1" }),
    failedDocuments: vi.fn(() =>
      failed.map((row) => ({ vector_store_id: "store-1", ...row })),
    ),
    updateDocument: vi.fn(),
    setStoreState: vi.fn(),
    refreshStoreState: vi.fn(),
    snapshot: vi.fn(() => ({ stores: [], documents: [] })),
  };
  const service = new VectorStoreService(
    data as never,
    {} as never,
    createDirectory(),
    { finalizeVectorIndex: vi.fn(async () => undefined) } as never,
  );
  return { service, data };
}

describe("VectorStoreService retryFailed", () => {
  it("requeues failed documents and reingests the stored file", async () => {
    const root = createDirectory();
    const path = join(root, "scan.pdf");
    writeFileSync(path, "scanned-bytes");
    const { service, data } = createService([
      {
        id: "document-1",
        file_name: "scan.pdf",
        mime_type: "application/pdf",
        local_path: path,
      },
    ]);
    const seen: Array<{ id: string; fileName: string; bytes: number }> = [];
    const internal = service as unknown as {
      ingest: (
        input: { fileName: string },
        id: string,
        path: string,
        buffer: Buffer,
      ) => Promise<void>;
    };
    vi.spyOn(internal, "ingest").mockImplementation(
      async (input, id, _path, buffer) => {
        seen.push({ id, fileName: input.fileName, bytes: buffer.byteLength });
      },
    );

    await service.retryFailed("store-1");
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    expect(data.updateDocument).toHaveBeenCalledWith("document-1", "queued", 0);
    expect(data.setStoreState).toHaveBeenCalledWith("store-1", "indexing");
    expect(seen[0]).toEqual({
      id: "document-1",
      fileName: "scan.pdf",
      bytes: "scanned-bytes".length,
    });
  });

  it("marks a document failed when its stored file has gone missing", async () => {
    const root = createDirectory();
    const { service, data } = createService([
      {
        id: "document-2",
        file_name: "gone.pdf",
        mime_type: "application/pdf",
        local_path: join(root, "gone.pdf"),
      },
    ]);
    const internal = service as unknown as { ingest: () => Promise<void> };
    const ingest = vi
      .spyOn(internal, "ingest")
      .mockImplementation(async () => undefined);

    await service.retryFailed("store-1");
    await vi.waitFor(() =>
      expect(data.updateDocument).toHaveBeenCalledWith(
        "document-2",
        "failed",
        100,
        0,
        "Файл не найден на диске — возможно, его переместили или удалили.",
      ),
    );

    expect(ingest).not.toHaveBeenCalled();
  });

  it("does nothing when the store has no failed documents", async () => {
    const { service, data } = createService([]);

    await service.retryFailed("store-1");

    expect(data.updateDocument).not.toHaveBeenCalled();
    expect(data.setStoreState).not.toHaveBeenCalled();
  });
});

describe("VectorStoreService resumeInterrupted", () => {
  it("requeues documents left in flight by a restart instead of failing them", async () => {
    const folder = createDirectory();
    const path = join(folder, "interrupted.txt");
    writeFileSync(path, "содержимое");
    const rows = [
      {
        id: "document-1",
        vector_store_id: "store-1",
        file_name: "interrupted.txt",
        mime_type: "text/plain",
        local_path: path,
      },
      {
        id: "document-2",
        vector_store_id: "store-2",
        file_name: "interrupted.txt",
        mime_type: "text/plain",
        local_path: path,
      },
    ];
    const data = {
      store: () => ({ id: "store-1", embeddingModelId: "embedding-1" }),
      recoverInterruptedDocuments: vi.fn(() => rows),
      updateDocument: vi.fn(),
      setStoreState: vi.fn(),
      refreshStoreState: vi.fn(),
      snapshot: vi.fn(() => ({ stores: [], documents: [] })),
    };
    const service = new VectorStoreService(
      data as never,
      {} as never,
      createDirectory(),
      {
        initializeVectorIndex: vi.fn(() => false),
        completeVectorIndexInitialization: vi.fn(),
        resumeIndexing: vi.fn(),
        finalizeVectorIndex: vi.fn(async () => undefined),
      } as never,
      undefined,
    );
    const internal = service as unknown as { ingest: () => Promise<boolean> };
    vi.spyOn(internal, "ingest").mockResolvedValue("succeeded" as never);

    service.resumeInterrupted();

    expect(data.updateDocument).toHaveBeenCalledWith("document-1", "queued", 0);
    expect(data.updateDocument).toHaveBeenCalledWith("document-2", "queued", 0);
    expect(data.setStoreState).toHaveBeenCalledWith("store-1", "indexing");
    expect(data.setStoreState).toHaveBeenCalledWith("store-2", "indexing");
    await vi.waitFor(() => {
      expect(service.progress("store-1")).toBeNull();
      expect(service.progress("store-2")).toBeNull();
    });
  });
});
