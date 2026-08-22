export type SecretCategorySystemKey = "api-keys" | "personal-data";

export interface SecretCategory {
  id: number;
  portableId: string;
  systemKey?: SecretCategorySystemKey;
  label: string;
  builtin: boolean;
}
export interface SecretEntity {
  id: number;
  portableId: string;
  categoryId: number;
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
