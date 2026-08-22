import type {
  SecretCategory,
  SecretEntity,
  SecretStorageSnapshot,
} from "../../shared/models/secret-storage";
import type {
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../shared/dto";

export type * from "../../shared/models/secret-storage";

export interface SecretStorageApi {
  getSnapshot(): Promise<SecretStorageSnapshot>;
  upsertCategory(input: UpsertSecretCategoryInput): Promise<SecretCategory>;
  upsertSecret(input: UpsertSecretInput): Promise<SecretEntity>;
  deleteCategory(id: string): Promise<void>;
  deleteSecret(id: string): Promise<void>;
  copySecret(id: string): Promise<void>;
}

export const SECRET_IPC_CHANNELS = {
  getSnapshot: "secrets:get-snapshot",
  upsertCategory: "secrets:upsert-category",
  upsertSecret: "secrets:upsert-secret",
  deleteCategory: "secrets:delete-category",
  deleteSecret: "secrets:delete-secret",
  copySecret: "secrets:copy-secret",
} as const;
