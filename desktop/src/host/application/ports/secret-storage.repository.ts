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

export interface SecretStorageRepository {
  getSnapshot(): SecretStorageSnapshot;
  upsertCategory(input: UpsertSecretCategoryInput): SecretCategory;
  upsertSecret(input: UpsertSecretInput): SecretEntity;
  deleteCategory(id: number): void;
  deleteSecret(id: number): void;
  getSecret(id: number): SecretRecord | undefined;
}
