import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VectorStoreService } from "../../src/host/infrastructure/vector-store/vector-store.service";
import { BUILTIN_EMBEDDING_MODEL_IDS } from "../../src/shared/entity-ids";

let directory: string | undefined;

function createDirectory() {
  directory = mkdtempSync(join(tmpdir(), "zvs-embedding-"));
  return directory;
}

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

const LOCAL = BUILTIN_EMBEDDING_MODEL_IDS.bgeM3;

function createService() {
  const data = {
    embeddingModel: vi.fn(() => undefined),
    store: vi.fn(() => undefined),
    upsert: vi.fn(() => "store-1"),
    snapshot: vi.fn(() => ({ stores: [], documents: [] })),
  };
  return {
    data,
    service: new VectorStoreService(
      data as never,
      {} as never,
      createDirectory(),
      {} as never,
    ),
  };
}

describe("VectorStoreService local embedding model", () => {
  it("saves the built-in downloaded model independently of provider models", async () => {
    const { data, service } = createService();

    await expect(
      service.upsert({
        name: "База знаний",
        description: "",
        embeddingModelId: LOCAL,
        searchMode: "vector",
        chunkSizeTokens: 700,
        chunkOverlapTokens: 100,
      }),
    ).resolves.toEqual({ stores: [], documents: [] });

    expect(data.embeddingModel).not.toHaveBeenCalled();
    expect(data.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ embeddingModelId: LOCAL }),
    );
  });

  it("continues rejecting unknown provider model ids", async () => {
    const { service } = createService();

    await expect(
      service.upsert({
        name: "База знаний",
        description: "",
        embeddingModelId: "00000000-0000-7000-8000-0000000009ff",
        searchMode: "vector",
        chunkSizeTokens: 700,
        chunkOverlapTokens: 100,
      }),
    ).rejects.toThrow("Выбрана недоступная embedding-модель");
  });
});
