import Database from "better-sqlite3";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectManagementService } from "../../src/host/application/services/project-management.service";
import { DirectoryPolicyRepository } from "../../src/host/infrastructure/database/directory-policy.repository";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ProjectRepository } from "../../src/host/infrastructure/database/project.repository";

let database: Database.Database | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

function createService() {
  database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  runMigrations(database);
  const directoryPolicy = new DirectoryPolicyRepository(database);
  const service = new ProjectManagementService(
    new ProjectRepository(database),
    directoryPolicy,
  );
  return { service, directoryPolicy };
}

describe("глобальная политика директории проекта", () => {
  it("добавляет рекурсивный доступ при создании проекта из UI", () => {
    const { service, directoryPolicy } = createService();
    const rootPath = resolve("fixtures", "ui-project");

    service.upsert({
      name: "UI project",
      rootPath,
      instructions: "",
      defaultAgentId: null,
      defaultModelId: null,
      compactThreshold: 0.78,
      archived: false,
      grants: [],
    });

    expect(directoryPolicy.get().grants).toEqual([
      {
        path: rootPath,
        recursive: true,
        permissions: ["read", "create", "modify"],
      },
    ]);
  });

  it("добавляет доступ для CLI и расширяет существующее правило", () => {
    const { service, directoryPolicy } = createService();
    const rootPath = resolve("fixtures", "cli-project");
    directoryPolicy.upsert({
      grants: [
        {
          path: rootPath,
          recursive: false,
          permissions: ["execute"],
        },
      ],
    });

    service.ensureForDirectory(rootPath);
    service.ensureForDirectory(rootPath);

    expect(directoryPolicy.get().grants).toEqual([
      {
        path: rootPath,
        recursive: true,
        permissions: ["execute", "read", "create", "modify"],
      },
    ]);
  });
});
