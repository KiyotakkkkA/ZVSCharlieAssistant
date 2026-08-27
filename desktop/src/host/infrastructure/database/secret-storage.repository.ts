import { safeStorage } from "electron";
import type Database from "better-sqlite3";
import { newEntityId } from "./entity-id";
import type {
  SecretCategory,
  SecretCategorySystemKey,
  SecretRecord,
  SecretStorageSnapshot,
} from "../../../shared/models/secret-storage";
import type {
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../../shared/dto";
import type {
  DataTransferConflictPolicy,
  ImportPreview,
  ImportResult,
} from "../../../shared/models/data-transfer";
import type { PortableSecretStorage } from "../data-transfer/secret-storage-transfer";

interface CategoryRow {
  id: string;
  system_key: SecretCategorySystemKey | null;
  label: string;
  builtin: number;
}

interface SecretRow {
  id: string;
  category_id: string;
  label: string;
  content: string;
  builtin: number;
}

const ENCRYPTED_PREFIX = "enc:v1:";

const encryptSecret = (value: string): string => {
  if (!safeStorage.isEncryptionAvailable()) return value;
  return ENCRYPTED_PREFIX + safeStorage.encryptString(value).toString("base64");
};

const decryptSecret = (value: string): string => {
  if (!value.startsWith(ENCRYPTED_PREFIX)) return value;
  try {
    return safeStorage.decryptString(
      Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64"),
    );
  } catch {
    throw new Error(
      "Не удалось расшифровать секрет: хранилище создано под другой учётной записью или профиль повреждён",
    );
  }
};

const mapCategory = (row: CategoryRow): SecretCategory => ({
  id: row.id,
  systemKey: row.system_key ?? undefined,
  label: row.label,
  builtin: Boolean(row.builtin),
});

const mapSecret = (row: SecretRow): SecretRecord => ({
  id: row.id,
  categoryId: row.category_id,
  label: row.label,
  content: decryptSecret(row.content),
  builtin: Boolean(row.builtin),
});

export class SecretStorageRepository {
  constructor(private readonly database: Database.Database) {}

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  getSnapshot(): SecretStorageSnapshot {
    const rows = this.database
      .prepare(
        `SELECT id, category_id, label, builtin
         FROM secret_entities
         ORDER BY builtin DESC, label ASC`,
      )
      .all() as Array<Omit<SecretRow, "content">>;

    return {
      categories: this.listCategories(),
      secrets: rows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        label: row.label,
        builtin: Boolean(row.builtin),
      })),
    };
  }

  encryptLegacySecrets(): void {
    if (!safeStorage.isEncryptionAvailable()) return;
    const rows = this.database
      .prepare("SELECT id, content FROM secret_entities")
      .all() as Array<{ id: string; content: string }>;
    const pending = rows.filter(
      (row) => !row.content.startsWith(ENCRYPTED_PREFIX),
    );
    if (!pending.length) return;
    const update = this.database.prepare(
      "UPDATE secret_entities SET content = ? WHERE id = ?",
    );
    this.database.transaction(() => {
      for (const row of pending) update.run(encryptSecret(row.content), row.id);
    })();
  }

  listCategories(): SecretCategory[] {
    const rows = this.database
      .prepare(
        "SELECT id, system_key, label, builtin FROM secret_categories ORDER BY builtin DESC, label ASC",
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

  exportPortable(): PortableSecretStorage {
    const categories = this.listCategories();
    return {
      version: 2,
      categories: categories.map(({ id, systemKey, label }) => ({
        id,
        ...(systemKey ? { systemKey } : {}),
        label,
      })),
      secrets: this.listSecrets().map((secret) => ({
        id: secret.id,
        categoryId: secret.categoryId,
        label: secret.label,
        content: secret.content,
      })),
    };
  }

  previewPortable(
    input: PortableSecretStorage,
  ): Pick<ImportPreview, "categories" | "secrets" | "conflicts"> {
    const categories = { create: 0, update: 0, conflict: 0 };
    const secrets = { create: 0, update: 0, conflict: 0 };
    const conflicts: ImportPreview["conflicts"] = [];
    const categoryIds = new Map<string, string | null>();

    for (const category of input.categories) {
      const byIdentity = this.findCategoryIdentity(
        category.id,
        category.systemKey,
      );
      const byLabel = this.findCategoryByLabel(category.label);
      if (byIdentity && byLabel && byIdentity.id !== byLabel.id) {
        categories.conflict++;
        conflicts.push({
          kind: "category",
          label: category.label,
          reason: "Переносимый ID и название относятся к разным категориям",
        });
        categoryIds.set(category.id, byIdentity.id);
      } else if (byIdentity) {
        categories.update++;
        categoryIds.set(category.id, byIdentity.id);
      } else if (byLabel) {
        categories.conflict++;
        conflicts.push({
          kind: "category",
          label: category.label,
          reason: "Категория с таким названием уже существует",
        });
        categoryIds.set(category.id, byLabel.id);
      } else {
        categories.create++;
        categoryIds.set(category.id, null);
      }
    }

    for (const secret of input.secrets) {
      const byIdentity = this.findSecretById(secret.id);
      const targetCategoryId = categoryIds.get(secret.categoryId);
      const byLabel = targetCategoryId
        ? this.findSecretByLabel(targetCategoryId, secret.label)
        : undefined;
      if (byIdentity && byLabel && byIdentity.id !== byLabel.id) {
        secrets.conflict++;
        conflicts.push({
          kind: "secret",
          label: secret.label,
          reason: "Переносимый ID и название относятся к разным секретам",
        });
      } else if (byIdentity) secrets.update++;
      else if (byLabel) {
        secrets.conflict++;
        conflicts.push({
          kind: "secret",
          label: secret.label,
          reason: "Секрет с таким названием уже существует в категории",
        });
      } else secrets.create++;
    }

    return { categories, secrets, conflicts };
  }

  importPortable(
    input: PortableSecretStorage,
    conflictPolicy: DataTransferConflictPolicy,
  ): Pick<ImportResult, "categories" | "secrets" | "skipped"> {
    return this.database.transaction(() => {
      const result: Pick<ImportResult, "categories" | "secrets" | "skipped"> = {
        categories: { create: 0, update: 0 },
        secrets: { create: 0, update: 0 },
        skipped: 0,
      };
      const categoryIds = new Map<string, string>();

      for (const category of input.categories) {
        const byIdentity = this.findCategoryIdentity(
          category.id,
          category.systemKey,
        );
        const byLabel = this.findCategoryByLabel(category.label);
        const existing = byIdentity ?? byLabel;
        if (existing) {
          categoryIds.set(category.id, existing.id);
          if (conflictPolicy === "overwrite" && !existing.builtin) {
            if (!byLabel || byLabel.id === existing.id) {
              this.database
                .prepare("UPDATE secret_categories SET label = ? WHERE id = ?")
                .run(category.label, existing.id);
              result.categories.update++;
            } else result.skipped++;
          } else result.skipped++;
          continue;
        }
        this.database
          .prepare("INSERT INTO secret_categories (id, label) VALUES (?, ?)")
          .run(category.id, category.label);
        categoryIds.set(category.id, category.id);
        result.categories.create++;
      }

      for (const secret of input.secrets) {
        const categoryId = categoryIds.get(secret.categoryId);
        if (!categoryId) throw new Error("Не найдена категория секрета");
        const byIdentity = this.findSecretById(secret.id);
        const byLabel = this.findSecretByLabel(categoryId, secret.label);
        if (byIdentity && byLabel && byIdentity.id !== byLabel.id) {
          result.skipped++;
          continue;
        }
        const existing = byIdentity ?? byLabel;
        if (existing) {
          if (conflictPolicy === "overwrite" && !existing.builtin) {
            this.database
              .prepare(
                `UPDATE secret_entities
                 SET category_id = ?, label = ?, content = ? WHERE id = ?`,
              )
              .run(
                categoryId,
                secret.label,
                encryptSecret(secret.content),
                existing.id,
              );
            result.secrets.update++;
          } else result.skipped++;
          continue;
        }
        this.database
          .prepare(
            `INSERT INTO secret_entities
              (id, category_id, label, content)
             VALUES (?, ?, ?, ?)`,
          )
          .run(
            secret.id,
            categoryId,
            secret.label,
            encryptSecret(secret.content),
          );
        result.secrets.create++;
      }
      return result;
    })();
  }

  private findCategoryIdentity(
    id: string,
    systemKey?: string,
  ): SecretCategory | undefined {
    const row = this.database
      .prepare(
        `SELECT id, system_key, label, builtin
         FROM secret_categories
         WHERE id = ? OR (? IS NOT NULL AND system_key = ?)`,
      )
      .get(id, systemKey ?? null, systemKey ?? null) as CategoryRow | undefined;
    return row ? mapCategory(row) : undefined;
  }

  private findCategoryByLabel(label: string): SecretCategory | undefined {
    const row = this.database
      .prepare(
        `SELECT id, system_key, label, builtin
         FROM secret_categories WHERE label = ? COLLATE NOCASE`,
      )
      .get(label) as CategoryRow | undefined;
    return row ? mapCategory(row) : undefined;
  }

  private findSecretById(id: string): SecretRecord | undefined {
    const row = this.database
      .prepare(
        `SELECT id, category_id, label, content, builtin
         FROM secret_entities WHERE id = ?`,
      )
      .get(id) as SecretRow | undefined;
    return row ? mapSecret(row) : undefined;
  }

  private findSecretByLabel(
    categoryId: string,
    label: string,
  ): SecretRecord | undefined {
    const row = this.database
      .prepare(
        `SELECT id, category_id, label, content, builtin
         FROM secret_entities
         WHERE category_id = ? AND label = ? COLLATE NOCASE
         ORDER BY id LIMIT 1`,
      )
      .get(categoryId, label) as SecretRow | undefined;
    return row ? mapSecret(row) : undefined;
  }

  findCategory(id: string): SecretCategory | undefined {
    const row = this.database
      .prepare(
        "SELECT id, system_key, label, builtin FROM secret_categories WHERE id = ?",
      )
      .get(id) as CategoryRow | undefined;

    return row ? mapCategory(row) : undefined;
  }

  findSecret(id: string): SecretRecord | undefined {
    const row = this.database
      .prepare(
        "SELECT id, category_id, label, content, builtin FROM secret_entities WHERE id = ?",
      )
      .get(id) as SecretRow | undefined;

    return row ? mapSecret(row) : undefined;
  }

  categoryExists(id: string): boolean {
    return Boolean(
      this.database
        .prepare("SELECT 1 FROM secret_categories WHERE id = ?")
        .get(id),
    );
  }

  upsertCategory(input: UpsertSecretCategoryInput): SecretCategory {
    if (input.id === undefined) {
      const id = newEntityId();
      this.database
        .prepare("INSERT INTO secret_categories (id, label) VALUES (?, ?)")
        .run(id, input.label);
      return this.findCategory(id)!;
    }

    const result = this.database
      .prepare("UPDATE secret_categories SET label = ? WHERE id = ?")
      .run(input.label, input.id);
    if (result.changes === 0) throw new Error("Категория не найдена");
    return this.findCategory(input.id)!;
  }

  upsertSecret(input: UpsertSecretInput): SecretRecord {
    if (input.id === undefined) {
      const id = newEntityId();
      this.database
        .prepare(
          `INSERT INTO secret_entities (id, category_id, label, content)
           VALUES (?, ?, ?, ?)`,
        )
        .run(id, input.categoryId, input.label, encryptSecret(input.content!));
      return this.findSecret(id)!;
    }

    const result = this.database
      .prepare(
        `UPDATE secret_entities
         SET category_id = ?, label = ?, content = COALESCE(?, content)
         WHERE id = ?`,
      )
      .run(
        input.categoryId,
        input.label,
        input.content === undefined || input.content === null
          ? null
          : encryptSecret(input.content),
        input.id,
      );
    if (result.changes === 0) throw new Error("Секрет не найден");
    return this.findSecret(input.id)!;
  }

  private integrationsUsingSecret(secretIds: string[]): string[] {
    if (secretIds.length === 0) return [];
    const placeholders = secretIds.map(() => "?").join(",");
    return (
      this.database
        .prepare(
          `SELECT DISTINCT p.name
           FROM integration_secret_bindings b
           JOIN integration_profiles p ON p.id = b.profile_id
           WHERE b.secret_id IN (${placeholders})
           ORDER BY p.name`,
        )
        .all(...secretIds) as Array<{ name: string }>
    ).map((row) => row.name);
  }

  deleteCategory(id: string): void {
    const secretIds = (
      this.database
        .prepare("SELECT id FROM secret_entities WHERE category_id = ?")
        .all(id) as Array<{ id: string }>
    ).map((row) => row.id);
    const blocking = this.integrationsUsingSecret(secretIds);
    if (blocking.length)
      throw new Error(
        `Секреты этой категории используются подключениями: ${blocking.join(", ")}. Отвяжите их перед удалением категории.`,
      );

    const result = this.database
      .prepare("DELETE FROM secret_categories WHERE id = ? AND builtin = 0")
      .run(id);
    if (result.changes === 0)
      throw new Error("Категория не найдена или не подлежит удалению");
  }

  deleteSecret(id: string): void {
    const blocking = this.integrationsUsingSecret([id]);
    if (blocking.length)
      throw new Error(
        `Секрет используется подключениями: ${blocking.join(", ")}. Отвяжите его перед удалением.`,
      );

    const result = this.database
      .prepare("DELETE FROM secret_entities WHERE id = ? AND builtin = 0")
      .run(id);
    if (result.changes === 0)
      throw new Error("Секрет не найден или не подлежит удалению");
  }
}
