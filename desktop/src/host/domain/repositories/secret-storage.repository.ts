import type {
  SecretCategory,
  SecretEntity,
  SecretStorageSnapshot,
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../../ipc/contracts";

export interface SecretStorageRepository {
  getSnapshot(): SecretStorageSnapshot;
  upsertCategory(input: UpsertSecretCategoryInput): SecretCategory;
  upsertSecret(input: UpsertSecretInput): SecretEntity;
  deleteCategory(id: number): void;
  deleteSecret(id: number): void;
}
