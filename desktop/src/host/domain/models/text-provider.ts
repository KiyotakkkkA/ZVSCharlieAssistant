export type TextProviderKind = "ollama";
export type TextProviderType = "text" | "embedding";
export interface TextProviderModelDetails { parentModel: string; format: string; family: string; families: string[] | null; parameterSize: string; quantizationLevel: string }
export interface TextProviderModelInfo { id: string; name: string; modifiedAt: string; size: number; digest: string; details: TextProviderModelDetails }
export interface TextProviderConfig { id: number; kind: TextProviderKind; providerType: TextProviderType; name: string; baseUrl: string; apiKeySecretId: number | null; enabled: boolean; checkedAt: string; createdAt: string; updatedAt: string }
export interface TextProviderModel extends Omit<TextProviderModelInfo, "id"> { id: number; remoteId: string; providerId: number; enabled: boolean }
export interface TextProviderSnapshot { providers: TextProviderConfig[]; models: TextProviderModel[] }
export interface UpsertTextProviderInput { id?: number; kind: TextProviderKind; providerType: TextProviderType; baseUrl: string; apiKeySecretId?: number; name: string; enabled: boolean; enabledModelIds: string[] }
export interface TestTextProviderConnectionInput { kind: TextProviderKind; providerType: TextProviderType; baseUrl: string; apiKeySecretId?: number }
export interface TestTextProviderConnectionResult { models: TextProviderModelInfo[]; checkedAt: string }
