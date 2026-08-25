import type Database from "better-sqlite3";
import { isAbsolute, normalize } from "node:path";
import type { DirectoryPolicy } from "../../../shared/models/directory-policy";
import {
  directoryGrantDtoSchema,
  parseJsonDto,
  type UpsertDirectoryPolicyInput,
} from "../../../shared/dto";
import { GLOBAL_ENTITY_IDS } from "../../../shared/entity-ids";

interface DirectoryPolicyRow {
  grants_json: string;
  updated_at: string;
}

export class DirectoryPolicyRepository {
  constructor(private readonly database: Database.Database) {}

  get(): DirectoryPolicy {
    const row = this.database
      .prepare("SELECT grants_json,updated_at FROM directory_policy WHERE id=?")
      .get(GLOBAL_ENTITY_IDS.directoryPolicy) as DirectoryPolicyRow;
    return {
      grants: parseJsonDto(directoryGrantDtoSchema.array(), row.grants_json),
      updatedAt: row.updated_at,
    };
  }

  upsert(input: UpsertDirectoryPolicyInput): DirectoryPolicy {
    const seen = new Set<string>();
    const grants = input.grants.map((grant) => {
      if (!isAbsolute(grant.path))
        throw new Error("Разрешённая директория должна иметь абсолютный путь");
      const path = normalize(grant.path);
      const key = path.toLowerCase();
      if (seen.has(key))
        throw new Error(`Директория ${path} добавлена повторно`);
      seen.add(key);
      return {
        ...grant,
        path,
        permissions: [...new Set(grant.permissions)],
      };
    });
    this.database
      .prepare(
        `UPDATE directory_policy
         SET grants_json=?,updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
      )
      .run(JSON.stringify(grants), GLOBAL_ENTITY_IDS.directoryPolicy);
    return this.get();
  }

  ensureGrant(
    grant: UpsertDirectoryPolicyInput["grants"][number],
  ): DirectoryPolicy {
    if (!isAbsolute(grant.path))
      throw new Error("Разрешённая директория должна иметь абсолютный путь");
    const path = normalize(grant.path);
    const key = path.toLowerCase();
    const current = this.get();
    const existing = current.grants.find(
      (item) => normalize(item.path).toLowerCase() === key,
    );
    const ensured = existing
      ? {
          ...existing,
          recursive: existing.recursive || grant.recursive,
          permissions: [
            ...new Set([...existing.permissions, ...grant.permissions]),
          ],
        }
      : { ...grant, path };
    return this.upsert({
      grants: existing
        ? current.grants.map((item) => (item === existing ? ensured : item))
        : [...current.grants, ensured],
    });
  }
}
