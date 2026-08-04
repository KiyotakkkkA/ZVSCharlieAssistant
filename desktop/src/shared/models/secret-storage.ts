export interface SecretCategory { id: number; label: string; builtin: boolean }
export interface SecretEntity { id: number; categoryId: number; label: string; builtin: boolean }
export interface SecretRecord extends SecretEntity { content: string }
export interface UpsertSecretCategoryInput { id?: number; label: string }
export interface UpsertSecretInput { id?: number; categoryId: number; label: string; content?: string }
export interface SecretStorageSnapshot { categories: SecretCategory[]; secrets: SecretEntity[] }
