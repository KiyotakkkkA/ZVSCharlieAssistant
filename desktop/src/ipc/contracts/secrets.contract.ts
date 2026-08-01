export interface SecretCategory {
  id: number;
  label: string;
  builtin: boolean;
}

export interface SecretEntity {
  id: number;
  categoryId: number;
  label: string;
  builtin: boolean;
}
export interface SecretRecord extends SecretEntity {
  content: string;
}

export interface UpsertSecretCategoryInput {
  id?: number;
  label: string;
}

export interface UpsertSecretInput {
  id?: number;
  categoryId: number;
  label: string;
  content?: string;
}

export interface SecretStorageSnapshot {
  categories: SecretCategory[];
  secrets: SecretEntity[];
}

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
