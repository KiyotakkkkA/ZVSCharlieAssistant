import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { TextProviderRepository } from "../../src/host/infrastructure/database/text-provider.repository";
import type { TextProviderModelInfo } from "../../src/shared/models/text-provider";

let database: Database.Database | undefined;

function model(id: string): TextProviderModelInfo {
  return {
    id,
    name: id,
    modifiedAt: "",
    size: 0,
    digest: "",
    details: {
      parentModel: "",
      format: "",
      family: "",
      families: null,
      parameterSize: "",
      quantizationLevel: "",
    },
  };
}

function createRepository() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  database = db;
  return new TextProviderRepository(db);
}

const input = (id: string | undefined, enabledModelIds: string[]) => ({
  id,
  kind: "openrouter" as const,
  providerType: "text" as const,
  name: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  enabled: true,
  enabledModelIds,
  generationSettings: { maxOutputTokens: 8192, temperature: 0.7, topP: 0.9 },
});

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("список моделей провайдера", () => {
  it("перестаёт учитывать модели, которых провайдер больше не отдаёт", () => {
    const repository = createRepository();

    const first = repository.upsert(
      input(undefined, ["a"]),
      undefined,
      "2026-01-01T00:00:00.000Z",
      [model("a"), model("b"), model("c")],
      null,
    );
    const providerId = first.providers[0]!.id;
    expect(first.models).toHaveLength(3);

    const second = repository.upsert(
      input(providerId, ["a"]),
      providerId,
      "2026-01-02T00:00:00.000Z",
      [model("a"), model("b")],
      null,
    );

    expect(second.models.map((item) => item.remoteId).sort()).toEqual([
      "a",
      "b",
    ]);
  });

  it("возвращает исчезнувшую модель, когда провайдер снова её отдаёт", () => {
    const repository = createRepository();
    const first = repository.upsert(
      input(undefined, ["a"]),
      undefined,
      "2026-01-01T00:00:00.000Z",
      [model("a"), model("b")],
      null,
    );
    const providerId = first.providers[0]!.id;

    repository.upsert(
      input(providerId, ["a"]),
      providerId,
      "2026-01-02T00:00:00.000Z",
      [model("a")],
      null,
    );
    const restored = repository.upsert(
      input(providerId, ["a", "b"]),
      providerId,
      "2026-01-03T00:00:00.000Z",
      [model("a"), model("b")],
      null,
    );

    expect(restored.models).toHaveLength(2);
    expect(restored.models.find((item) => item.remoteId === "b")?.enabled).toBe(
      true,
    );
  });

  it("не теряет строку модели, на которую ссылается история", () => {
    const repository = createRepository();
    const first = repository.upsert(
      input(undefined, ["a", "b"]),
      undefined,
      "2026-01-01T00:00:00.000Z",
      [model("a"), model("b")],
      null,
    );
    const providerId = first.providers[0]!.id;
    const removed = first.models.find((item) => item.remoteId === "b")!;

    repository.upsert(
      input(providerId, ["a"]),
      providerId,
      "2026-01-02T00:00:00.000Z",
      [model("a")],
      null,
    );

    const row = database!
      .prepare("SELECT available FROM text_provider_models WHERE id=?")
      .get(removed.id) as { available: number } | undefined;
    expect(row?.available).toBe(0);
  });
});
