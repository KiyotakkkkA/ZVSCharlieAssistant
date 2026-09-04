import { describe, expect, it, vi } from "vitest";
import { EmbeddingService } from "../../src/host/infrastructure/vector-store/embedding.service";
import { BUILTIN_EMBEDDING_MODEL_IDS } from "../../src/shared/entity-ids";

const LOCAL = BUILTIN_EMBEDDING_MODEL_IDS.bgeM3;

function createService(indexer?: unknown) {
  const data = { embeddingModel: vi.fn(() => undefined) };
  const service = new EmbeddingService(
    data as never,
    {} as never,
    indexer as never,
  );
  return { service, data };
}

describe("EmbeddingService", () => {
  it("builds vectors locally for the built-in model without touching the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const embed = vi.fn().mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const { service, data } = createService({ embed });

    const vectors = await service.embed(LOCAL, ["первый", "второй"]);

    expect(vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    expect(embed).toHaveBeenCalledWith(["первый", "второй"]);
    expect(data.embeddingModel).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("explains the missing addon instead of falling back to the network", async () => {
    const { service } = createService(undefined);

    await expect(service.embed(LOCAL, ["текст"])).rejects.toThrow(
      /не установлена/,
    );
  });

  it("still resolves external models through the provider registry", async () => {
    const { service, data } = createService({ embed: vi.fn() });

    await expect(
      service.embed("00000000-0000-7000-8000-0000000009ff", ["текст"]),
    ).rejects.toThrow("Embedding-модель недоступна или отключена");
    expect(data.embeddingModel).toHaveBeenCalledOnce();
  });
});
