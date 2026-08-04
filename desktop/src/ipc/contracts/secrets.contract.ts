import type {
  SecretCategory,
  SecretEntity,
  SecretStorageSnapshot,
  UpsertSecretCategoryInput,
  UpsertSecretInput,
} from "../../shared/models/secret-storage";

export type * from "../../shared/models/secret-storage";

export interface SecretStorageApi {
  getSnapshot(): Promise<SecretStorageSnapshot>;
  upsertCategory(input: UpsertSecretCategoryInput): Promise<SecretCategory>;
  upsertSecret(input: UpsertSecretInput): Promise<SecretEntity>;
  deleteCategory(id: number): Promise<void>;
  deleteSecret(id: number): Promise<void>;
  copySecret(id: number): Promise<void>;
}

export const SECRET_IPC_CHANNELS = {
  getSnapshot: "secrets:get-snapshot",
  upsertCategory: "secrets:upsert-category",
  upsertSecret: "secrets:upsert-secret",
  deleteCategory: "secrets:delete-category",
  deleteSecret: "secrets:delete-secret",
  copySecret: "secrets:copy-secret",
} as const;
