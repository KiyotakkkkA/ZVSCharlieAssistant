import type Database from "better-sqlite3";
import { randomInt } from "node:crypto";
import { isAbsolute, normalize, resolve } from "node:path";
import type { Project } from "../../../shared/models/project";
import {
  directoryGrantDtoSchema,
  parseIpcDto,
  type DirectoryGrant,
  type UpsertProjectInput,
} from "../../../shared/dto";
import { newEntityId } from "./entity-id";

interface ProjectRow {
  id: string;
  name: string;
  root_path: string | null;
  instructions: string;
  default_agent_id: string | null;
  default_model_id: string | null;
  compact_threshold: number;
  archived: number;
  created_at: string;
  updated_at: string;
}

interface GrantRow {
  id: string;
  project_id: string;
  path: string;
  recursive: number;
  permissions_json: string;
}

export class ProjectRepository {
  constructor(private readonly db: Database.Database) {}

  list(): Project[] {
    const rows = this.db
      .prepare("SELECT * FROM projects ORDER BY archived, name")
      .all() as ProjectRow[];
    const grants = this.grantsByProject();
    return rows.map((row) => map(row, grants.get(row.id) ?? []));
  }

  find(id: string): Project | undefined {
    const row = this.db.prepare("SELECT * FROM projects WHERE id=?").get(id) as
      ProjectRow | undefined;
    if (!row) return undefined;
    return map(row, this.grantsOf(id));
  }

  ensureForDirectory(directoryPath: string): Project {
    if (!directoryPath.trim() || !isAbsolute(directoryPath))
      throw new Error("Каталог проекта должен быть абсолютным путём");

    const rootPath = resolve(directoryPath);
    const existing = this.list().find(
      (project) =>
        project.rootPath !== null && samePath(project.rootPath, rootPath),
    );
    if (existing && !existing.archived) return existing;
    if (existing)
      return this.upsert({
        ...existing,
        rootPath,
        archived: false,
        grants: existing.grants,
      });

    return this.upsert({
      name: randomProjectName(),
      rootPath,
      instructions: "",
      defaultAgentId: null,
      defaultModelId: null,
      compactThreshold: 0.78,
      archived: false,
      grants: [
        {
          path: rootPath,
          recursive: true,
          permissions: ["read", "create", "modify"],
        },
      ],
    });
  }

  upsert(input: UpsertProjectInput): Project {
    const id = input.id ?? newEntityId();
    const rootPath = input.rootPath?.trim() ? normalize(input.rootPath) : null;
    if (rootPath && !isAbsolute(rootPath))
      throw new Error("Корень проекта должен быть абсолютным путём");

    const grants = input.grants.map((grant) => {
      if (!isAbsolute(grant.path))
        throw new Error("Разрешённая директория должна иметь абсолютный путь");
      return {
        ...grant,
        path: normalize(grant.path),
        permissions: [...new Set(grant.permissions)],
      };
    });

    const write = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO projects(id,name,root_path,instructions,default_agent_id,default_model_id,compact_threshold,archived)
           VALUES(?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             name=excluded.name,
             root_path=excluded.root_path,
             instructions=excluded.instructions,
             default_agent_id=excluded.default_agent_id,
             default_model_id=excluded.default_model_id,
             compact_threshold=excluded.compact_threshold,
             archived=excluded.archived,
             updated_at=CURRENT_TIMESTAMP`,
        )
        .run(
          id,
          input.name,
          rootPath,
          input.instructions,
          input.defaultAgentId,
          input.defaultModelId,
          input.compactThreshold,
          input.archived ? 1 : 0,
        );
      this.db
        .prepare("DELETE FROM project_directory_grants WHERE project_id=?")
        .run(id);
      const insert = this.db.prepare(
        "INSERT INTO project_directory_grants(id,project_id,path,recursive,permissions_json) VALUES(?,?,?,?,?)",
      );
      for (const grant of grants)
        insert.run(
          newEntityId(),
          id,
          grant.path,
          grant.recursive ? 1 : 0,
          JSON.stringify(grant.permissions),
        );
    });
    write();

    const created = this.find(id);
    if (!created) throw new Error("Не удалось сохранить проект");
    return created;
  }

  remove(id: string) {
    this.db.prepare("DELETE FROM projects WHERE id=?").run(id);
  }

  grantsOf(projectId: string): DirectoryGrant[] {
    return (
      this.db
        .prepare("SELECT * FROM project_directory_grants WHERE project_id=?")
        .all(projectId) as GrantRow[]
    ).map(mapGrant);
  }

  assignConversation(conversationId: string, projectId: string | null) {
    this.db
      .prepare(
        "UPDATE chat_conversations SET project_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(projectId, conversationId);
  }

  conversationProjectId(conversationId: string): string | null {
    const row = this.db
      .prepare("SELECT project_id FROM chat_conversations WHERE id=?")
      .get(conversationId) as { project_id: string | null } | undefined;
    return row?.project_id ?? null;
  }

  private grantsByProject(): Map<string, DirectoryGrant[]> {
    const rows = this.db
      .prepare("SELECT * FROM project_directory_grants")
      .all() as GrantRow[];
    const result = new Map<string, DirectoryGrant[]>();
    for (const row of rows) {
      const existing = result.get(row.project_id) ?? [];
      existing.push(mapGrant(row));
      result.set(row.project_id, existing);
    }
    return result;
  }
}

const mapGrant = (row: GrantRow): DirectoryGrant =>
  parseIpcDto(directoryGrantDtoSchema, {
    id: row.id,
    path: row.path,
    recursive: Boolean(row.recursive),
    permissions: JSON.parse(row.permissions_json) as unknown,
  });

const map = (row: ProjectRow, grants: DirectoryGrant[]): Project => ({
  id: row.id,
  name: row.name,
  rootPath: row.root_path,
  instructions: row.instructions,
  defaultAgentId: row.default_agent_id,
  defaultModelId: row.default_model_id,
  compactThreshold: row.compact_threshold,
  archived: Boolean(row.archived),
  grants,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const PROJECT_ADJECTIVES = [
  "Янтарный",
  "Лаймовый",
  "Северный",
  "Тихий",
  "Звёздный",
  "Быстрый",
] as const;
const PROJECT_NOUNS = [
  "Компас",
  "Маяк",
  "Вектор",
  "Каскад",
  "Спутник",
  "Контур",
] as const;

function randomProjectName(): string {
  const adjective = PROJECT_ADJECTIVES[randomInt(PROJECT_ADJECTIVES.length)];
  const noun = PROJECT_NOUNS[randomInt(PROJECT_NOUNS.length)];
  return `${adjective} ${noun} ${randomInt(100, 1000)}`;
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = resolve(left);
  const normalizedRight = resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}
