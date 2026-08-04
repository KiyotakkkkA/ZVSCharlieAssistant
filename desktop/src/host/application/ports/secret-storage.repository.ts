import type {
  SecretCategory,
  SecretEntity,
  SecretRecord,
  SecretStorageSnapshot,
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../../shared/models/secret-storage";

export interface SecretStorageRepository {
  getSnapshot(): SecretStorageSnapshot;
  upsertCategory(input: UpsertSecretCategoryInput): SecretCategory;
  upsertSecret(input: UpsertSecretInput): SecretEntity;
  deleteCategory(id: number): void;
  deleteSecret(id: number): void;
  getSecret(id: number): SecretRecord | undefined;
}
