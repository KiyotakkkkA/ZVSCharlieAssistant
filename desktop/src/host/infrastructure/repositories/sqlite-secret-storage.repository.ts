import type {
  SecretCategory,
  SecretEntity,
  SecretStorageSnapshot,
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../../ipc/contracts";
import type { SecretStorageRepository } from "../../domain/repositories/secret-storage.repository";
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
      secrets: this.dataSource.listSecrets(),
    };
  }

  getSecret(id: number): SecretEntity | undefined {
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
    if (!input.content.trim())
      throw new Error("Содержимое секрета обязательно");

    return this.dataSource.upsertSecret({
      ...input,
      label: normalizeLabel(input.label),
    });
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
