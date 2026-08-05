import type {
  SecretCategory,
  SecretEntity,
  SecretRecord,
  SecretStorageSnapshot,
} from "../../../shared/models/secret-storage";
import type {
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../../shared/dto";
import type { SecretStorageRepository } from "../../application/ports/secret-storage.repository";
import { SecretStorageDataSource } from "../database/secret-storage.data-source";

const normalizeLabel = (label: string): string => {
  const normalized = label.trim();
  if (!normalized) throw new Error("Название не может быть пустым");
  if (normalized.length > 120)
    throw new Error("Название не может быть длиннее 120 символов");
  return normalized;
};

export class SqliteSecretStorageRepository implements SecretStorageRepository {
  constructor(private readonly dataSource: SecretStorageDataSource) {}

  getSnapshot(): SecretStorageSnapshot {
    return {
      categories: this.dataSource.listCategories(),
      secrets: this.dataSource
        .listSecrets()
        .map(({ content: _content, ...secret }) => secret),
    };
  }

  getSecret(id: number): SecretRecord | undefined {
    return this.dataSource.findSecret(id);
  }

  upsertCategory(input: UpsertSecretCategoryInput): SecretCategory {
    return this.dataSource.upsertCategory({
      ...input,
      label: normalizeLabel(input.label),
    });
  }

  upsertSecret(input: UpsertSecretInput): SecretEntity {
    if (!this.dataSource.categoryExists(input.categoryId))
      throw new Error("Выбранная категория не существует");
    if (input.id === undefined && !input.content?.trim())
      throw new Error("Содержимое секрета обязательно");

    const { content: _content, ...secret } = this.dataSource.upsertSecret({
      ...input,
      label: normalizeLabel(input.label),
    });
    return secret;
  }

  deleteCategory(id: number): void {
    if (!this.dataSource.categoryExists(id))
      throw new Error("Категория не существует");
    this.dataSource.deleteCategory(id);
  }

  deleteSecret(id: number): void {
    const secret = this.dataSource.findSecret(id);
    if (!secret) throw new Error("Секрет не существует");
    this.dataSource.deleteSecret(id);
  }
}
