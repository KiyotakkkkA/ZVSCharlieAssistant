import type Database from "better-sqlite3";
import { isAbsolute, normalize } from "node:path";
import type { DirectoryPolicy } from "../../../shared/models/directory-policy";
import {
  directoryGrantDtoSchema,
  parseJsonDto,
  type UpsertDirectoryPolicyInput,
} from "../../../shared/dto";

interface DirectoryPolicyRow {
  grants_json: string;
  updated_at: string;
}

export class DirectoryPolicyRepository {
  constructor(private readonly database: Database.Database) {}

  get(): DirectoryPolicy {
    const row = this.database
      .prepare("SELECT grants_json,updated_at FROM directory_policy WHERE id=1")
      .get() as DirectoryPolicyRow;
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
         WHERE id=1`,
      )
      .run(JSON.stringify(grants));
    return this.get();
  }
}
