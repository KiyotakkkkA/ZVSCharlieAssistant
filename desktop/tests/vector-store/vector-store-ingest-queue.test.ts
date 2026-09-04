import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VectorStoreService } from "../../src/host/infrastructure/vector-store/vector-store.service";

let directory: string | undefined;

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe("VectorStoreService ingest queue", () => {
  it("registers the whole batch and drains it with bounded concurrency", async () => {
    let documentIndex = 0;
    const data = {
      store: () => ({
        id: "store-1",
        embeddingModelId: "embedding-1",
      }),
      embeddingModel: () => true,
      documentByHash: () => undefined,
      createDocument: vi.fn(() => `document-${++documentIndex}`),
      setStoreState: vi.fn(),
      snapshot: vi.fn(() => ({ stores: [], documents: [] })),
    };
    directory = mkdtempSync(join(tmpdir(), "zvs-ingest-"));
    const service = new VectorStoreService(
      data as never,
      {} as never,
      directory,
      { finalizeVectorIndex: vi.fn(async () => undefined) } as never,
    );
    const releases: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    let started = 0;
    const internal = service as unknown as {
      ingest: () => Promise<void>;
    };
    vi.spyOn(internal, "ingest").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          started += 1;
          active += 1;
          maxActive = Math.max(maxActive, active);
          releases.push(() => {
            active -= 1;
            resolve();
          });
        }),
    );

    await service.upload(
      Array.from({ length: 5 }, (_, index) => ({
        vectorStoreId: "store-1",
        fileName: `document-${index}.txt`,
        mimeType: "text/plain",
        data: new TextEncoder().encode(`content-${index}`).buffer,
      })),
    );

    expect(data.createDocument).toHaveBeenCalledTimes(5);
    expect(started).toBe(2);
    for (let expectedStarted = 3; expectedStarted <= 5; expectedStarted += 1) {
      releases.shift()?.();
      await vi.waitFor(() => expect(started).toBe(expectedStarted));
    }
    while (releases.length) releases.shift()?.();
    await vi.waitFor(() => expect(active).toBe(0));
    expect(maxActive).toBe(2);
    expect(started).toBe(5);
  });

  it("persists a long display name before queuing under a short safe path", async () => {
    directory = mkdtempSync(join(tmpdir(), "zvs-ingest-name-"));
    let storedPath = "";
    const data = {
      store: () => ({ id: "store-1", embeddingModelId: "embedding-1" }),
      embeddingModel: () => true,
      documentByHash: () => undefined,
      createDocument: vi.fn(
        (_storeId, _fileName, _mimeType, path: string) => {
          storedPath = path;
          return "document-1";
        },
      ),
      setStoreState: vi.fn(),
      snapshot: vi.fn(() => ({ stores: [], documents: [] })),
    };
    const service = new VectorStoreService(
      data as never,
      {} as never,
      directory,
      { finalizeVectorIndex: vi.fn(async () => undefined) } as never,
    );
    const internal = service as unknown as { ingest: () => Promise<void> };
    vi.spyOn(internal, "ingest").mockResolvedValue(undefined);

    await service.upload([
      {
        vectorStoreId: "store-1",
        fileName:
          "расторж. дог/(Пичугов) 2-1505 2026/2-1505 2026. возраж. от 05.06.2026 (Пичугов).docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        data: new TextEncoder().encode("document bytes").buffer,
      },
    ]);

    expect(existsSync(storedPath)).toBe(true);
    expect(basename(storedPath)).toMatch(/^[a-f0-9]{64}\.docx$/);
    expect(data.createDocument).toHaveBeenCalledWith(
      "store-1",
      expect.stringContaining("Пичугов"),
      expect.any(String),
      storedPath,
      expect.any(String),
      expect.any(Number),
    );
  });
});
