import type Database from "better-sqlite3";
import type {
  SecretCategory,
  SecretRecord,
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

const mapSecret = (row: SecretRow): SecretRecord => ({
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

  listSecrets(): SecretRecord[] {
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

  findSecret(id: number): SecretRecord | undefined {
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

  upsertSecret(input: UpsertSecretInput): SecretRecord {
    if (input.id === undefined) {
      const result = this.database
        .prepare(
          `INSERT INTO secret_entities (category_id, label, content)
           VALUES (?, ?, ?)`,
        )
        .run(input.categoryId, input.label, input.content!);
      return this.findSecret(Number(result.lastInsertRowid))!;
    }

    const result = this.database
      .prepare(
        `UPDATE secret_entities
         SET category_id = ?, label = ?, content = COALESCE(?, content)
         WHERE id = ?`,
      )
      .run(input.categoryId, input.label, input.content, input.id);
    if (result.changes === 0) throw new Error("Секрет не найден");
    return this.findSecret(input.id)!;
  }

  deleteCategory(id: number): void {
    const result = this.database
      .prepare("DELETE FROM secret_categories WHERE id = ? AND builtin = 0")
      .run(id);
    if (result.changes === 0)
      throw new Error("Категория не найдена или не подлежит удалению");
  }

  deleteSecret(id: number): void {
    const result = this.database
      .prepare("DELETE FROM secret_entities WHERE id = ? AND builtin = 0")
      .run(id);
    if (result.changes === 0)
      throw new Error("Секрет не найден или не подлежит удалению");
  }
}
