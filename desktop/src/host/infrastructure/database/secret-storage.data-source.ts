import type Database from "better-sqlite3";
import type {
  SecretCategory,
  SecretEntity,
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../../ipc/contracts";

interface CategoryRow {
  id: number;
  label: string;
  builtin: number;
}

interface SecretRow {
  id: number;
  category_id: number;
  label: string;
  content: string;
  builtin: number;
}

const mapCategory = (row: CategoryRow): SecretCategory => ({
  id: row.id,
  label: row.label,
  builtin: Boolean(row.builtin),
});

const mapSecret = (row: SecretRow): SecretEntity => ({
  id: row.id,
  categoryId: row.category_id,
  label: row.label,
  content: row.content,
  builtin: Boolean(row.builtin),
});

export class SecretStorageDataSource {
  constructor(private readonly database: Database.Database) {}

  listCategories(): SecretCategory[] {
    const rows = this.database
      .prepare(
        "SELECT id, label, builtin FROM secret_categories ORDER BY builtin DESC, label ASC",
      )
      .all() as CategoryRow[];

    return rows.map(mapCategory);
  }

  listSecrets(): SecretEntity[] {
    const rows = this.database
      .prepare(
        `SELECT id, category_id, label, content, builtin
         FROM secret_entities
         ORDER BY builtin DESC, label ASC`,
      )
      .all() as SecretRow[];

    return rows.map(mapSecret);
  }

  findCategory(id: number): SecretCategory | undefined {
    const row = this.database
      .prepare("SELECT id, label, builtin FROM secret_categories WHERE id = ?")
      .get(id) as CategoryRow | undefined;

    return row ? mapCategory(row) : undefined;
  }

  findSecret(id: number): SecretEntity | undefined {
    const row = this.database
      .prepare(
        "SELECT id, category_id, label, content, builtin FROM secret_entities WHERE id = ?",
      )
      .get(id) as SecretRow | undefined;

    return row ? mapSecret(row) : undefined;
  }

  categoryExists(id: number): boolean {
    return Boolean(
      this.database
        .prepare("SELECT 1 FROM secret_categories WHERE id = ?")
        .get(id),
    );
  }

  upsertCategory(input: UpsertSecretCategoryInput): SecretCategory {
    if (input.id === undefined) {
      const result = this.database
        .prepare("INSERT INTO secret_categories (label) VALUES (?)")
        .run(input.label);
      return this.findCategory(Number(result.lastInsertRowid))!;
    }

    const result = this.database
      .prepare("UPDATE secret_categories SET label = ? WHERE id = ?")
      .run(input.label, input.id);
    if (result.changes === 0) throw new Error("Категория не найдена");
    return this.findCategory(input.id)!;
  }

  upsertSecret(input: UpsertSecretInput): SecretEntity {
    if (input.id === undefined) {
      const result = this.database
        .prepare(
          `INSERT INTO secret_entities (category_id, label, content)
           VALUES (?, ?, ?)`,
        )
        .run(input.categoryId, input.label, input.content);
      return this.findSecret(Number(result.lastInsertRowid))!;
    }

    const result = this.database
      .prepare(
        `UPDATE secret_entities
         SET category_id = ?, label = ?, content = ?
         WHERE id = ?`,
      )
      .run(input.categoryId, input.label, input.content, input.id);
    if (result.changes === 0) throw new Error("Секрет не найден");
    return this.findSecret(input.id)!;
  }
}
