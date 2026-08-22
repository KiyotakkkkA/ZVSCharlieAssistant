import { safeStorage } from "electron";
import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
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
  id: number;
  portable_id: string;
  system_key: SecretCategorySystemKey | null;
  label: string;
  builtin: number;
}

interface SecretRow {
  id: number;
  portable_id: string;
  category_id: number;
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
  portableId: row.portable_id,
  systemKey: row.system_key ?? undefined,
  label: row.label,
  builtin: Boolean(row.builtin),
});

const mapSecret = (row: SecretRow): SecretRecord => ({
  id: row.id,
  portableId: row.portable_id,
  categoryId: row.category_id,
  label: row.label,
  content: decryptSecret(row.content),
  builtin: Boolean(row.builtin),
});

export class SecretStorageRepository {
  constructor(private readonly database: Database.Database) {}

  getSnapshot(): SecretStorageSnapshot {
    const rows = this.database
      .prepare(
        `SELECT id, portable_id, category_id, label, builtin
         FROM secret_entities
         ORDER BY builtin DESC, label ASC`,
      )
      .all() as Array<Omit<SecretRow, "content">>;

    return {
      categories: this.listCategories(),
      secrets: rows.map((row) => ({
        id: row.id,
        portableId: row.portable_id,
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
      .all() as Array<{ id: number; content: string }>;
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
        "SELECT id, portable_id, system_key, label, builtin FROM secret_categories ORDER BY builtin DESC, label ASC",
      )
      .all() as CategoryRow[];

    return rows.map(mapCategory);
  }

  listSecrets(): SecretRecord[] {
    const rows = this.database
      .prepare(
        `SELECT id, portable_id, category_id, label, content, builtin
         FROM secret_entities
         ORDER BY builtin DESC, label ASC`,
      )
      .all() as SecretRow[];

    return rows.map(mapSecret);
  }

  exportPortable(): PortableSecretStorage {
    const categories = this.listCategories();
    const categoryPortableIds = new Map(
      categories.map((category) => [category.id, category.portableId]),
    );
    return {
      version: 1,
      categories: categories.map(({ portableId, systemKey, label }) => ({
        portableId,
        ...(systemKey ? { systemKey } : {}),
        label,
      })),
      secrets: this.listSecrets().map((secret) => ({
        portableId: secret.portableId,
        categoryPortableId: categoryPortableIds.get(secret.categoryId)!,
        label: secret.label,
        content: secret.content,
      })),
    };
  }

  previewPortable(input: PortableSecretStorage): Omit<ImportPreview, "sessionId" | "fileName"> {
    const categories = { create: 0, update: 0, conflict: 0 };
    const secrets = { create: 0, update: 0, conflict: 0 };
    const conflicts: ImportPreview["conflicts"] = [];
    const categoryIds = new Map<string, number>();

    for (const category of input.categories) {
      const byIdentity = this.findCategoryIdentity(
        category.portableId,
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
        categoryIds.set(category.portableId, byIdentity.id);
      } else if (byIdentity) {
        categories.update++;
        categoryIds.set(category.portableId, byIdentity.id);
      } else if (byLabel) {
        categories.conflict++;
        conflicts.push({
          kind: "category",
          label: category.label,
          reason: "Категория с таким названием уже существует",
        });
        categoryIds.set(category.portableId, byLabel.id);
      } else {
        categories.create++;
        categoryIds.set(category.portableId, -1);
      }
    }

    for (const secret of input.secrets) {
      const byIdentity = this.findSecretByPortableId(secret.portableId);
      const targetCategoryId = categoryIds.get(secret.categoryPortableId);
      const byLabel = targetCategoryId && targetCategoryId > 0
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
  ): ImportResult {
    return this.database.transaction(() => {
      const result: ImportResult = {
        categories: { create: 0, update: 0 },
        secrets: { create: 0, update: 0 },
        skipped: 0,
      };
      const categoryIds = new Map<string, number>();

      for (const category of input.categories) {
        const byIdentity = this.findCategoryIdentity(
          category.portableId,
          category.systemKey,
        );
        const byLabel = this.findCategoryByLabel(category.label);
        const existing = byIdentity ?? byLabel;
        if (existing) {
          categoryIds.set(category.portableId, existing.id);
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
        const inserted = this.database
          .prepare(
            "INSERT INTO secret_categories (portable_id, label) VALUES (?, ?)",
          )
          .run(category.portableId, category.label);
        categoryIds.set(category.portableId, Number(inserted.lastInsertRowid));
        result.categories.create++;
      }

      for (const secret of input.secrets) {
        const categoryId = categoryIds.get(secret.categoryPortableId);
        if (!categoryId) throw new Error("Не найдена категория секрета");
        const byIdentity = this.findSecretByPortableId(secret.portableId);
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
              (portable_id, category_id, label, content)
             VALUES (?, ?, ?, ?)`,
          )
          .run(
            secret.portableId,
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
    portableId: string,
    systemKey?: string,
  ): SecretCategory | undefined {
    const row = this.database
      .prepare(
        `SELECT id, portable_id, system_key, label, builtin
         FROM secret_categories
         WHERE portable_id = ? OR (? IS NOT NULL AND system_key = ?)`,
      )
      .get(portableId, systemKey ?? null, systemKey ?? null) as
      | CategoryRow
      | undefined;
    return row ? mapCategory(row) : undefined;
  }

  private findCategoryByLabel(label: string): SecretCategory | undefined {
    const row = this.database
      .prepare(
        `SELECT id, portable_id, system_key, label, builtin
         FROM secret_categories WHERE label = ? COLLATE NOCASE`,
      )
      .get(label) as CategoryRow | undefined;
    return row ? mapCategory(row) : undefined;
  }

  private findSecretByPortableId(portableId: string): SecretRecord | undefined {
    const row = this.database
      .prepare(
        `SELECT id, portable_id, category_id, label, content, builtin
         FROM secret_entities WHERE portable_id = ?`,
      )
      .get(portableId) as SecretRow | undefined;
    return row ? mapSecret(row) : undefined;
  }

  private findSecretByLabel(
    categoryId: number,
    label: string,
  ): SecretRecord | undefined {
    const row = this.database
      .prepare(
        `SELECT id, portable_id, category_id, label, content, builtin
         FROM secret_entities
         WHERE category_id = ? AND label = ? COLLATE NOCASE
         ORDER BY id LIMIT 1`,
      )
      .get(categoryId, label) as SecretRow | undefined;
    return row ? mapSecret(row) : undefined;
  }

  findCategory(id: number): SecretCategory | undefined {
    const row = this.database
      .prepare("SELECT id, portable_id, system_key, label, builtin FROM secret_categories WHERE id = ?")
      .get(id) as CategoryRow | undefined;

    return row ? mapCategory(row) : undefined;
  }

  findSecret(id: number): SecretRecord | undefined {
    const row = this.database
      .prepare(
        "SELECT id, portable_id, category_id, label, content, builtin FROM secret_entities WHERE id = ?",
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
        .prepare("INSERT INTO secret_categories (portable_id, label) VALUES (?, ?)")
        .run(randomUUID(), input.label);
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
          `INSERT INTO secret_entities (portable_id, category_id, label, content)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          input.categoryId,
          input.label,
          encryptSecret(input.content!),
        );
      return this.findSecret(Number(result.lastInsertRowid))!;
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

  private integrationsUsingSecret(secretIds: number[]): string[] {
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

  deleteCategory(id: number): void {
    const secretIds = (
      this.database
        .prepare("SELECT id FROM secret_entities WHERE category_id = ?")
        .all(id) as Array<{ id: number }>
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

  deleteSecret(id: number): void {
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
