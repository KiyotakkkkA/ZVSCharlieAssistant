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
}
