export type SecretCategorySystemKey = "api-keys" | "personal-data";

export interface SecretCategory {
  id: string;
  systemKey?: SecretCategorySystemKey;
  label: string;
  builtin: boolean;
}
export interface SecretEntity {
  id: string;
  categoryId: string;
  label: string;
  builtin: boolean;
}
export interface SecretRecord extends SecretEntity {
  content: string;
}
export interface SecretStorageSnapshot {
  categories: SecretCategory[];
  secrets: SecretEntity[];
}
