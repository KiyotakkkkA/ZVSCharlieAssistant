import Database from "better-sqlite3";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ProjectRepository } from "../../src/host/infrastructure/database/project.repository";

let database: Database.Database | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("проект для рабочего каталога CLI", () => {
  it("создаёт проект с базовыми настройками и повторно использует его", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);
    const projects = new ProjectRepository(database);
    const rootPath = resolve("fixtures", "cli-project");

    const created = projects.ensureForDirectory(rootPath);
    const existing = projects.ensureForDirectory(rootPath);

    expect(existing.id).toBe(created.id);
    expect(projects.list()).toHaveLength(1);
    expect(created).toMatchObject({
      rootPath,
      instructions: "",
      compactThreshold: 0.78,
      archived: false,
      defaultAgentId: null,
      defaultModelId: null,
      grants: [
        {
          path: rootPath,
          recursive: true,
          permissions: ["read", "create", "modify"],
        },
      ],
    });
    expect(created.name).toMatch(/^\S+ \S+ \d{3}$/u);
  });
});
