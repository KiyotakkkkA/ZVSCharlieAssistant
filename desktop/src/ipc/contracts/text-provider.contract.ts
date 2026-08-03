export type TextProviderKind = "ollama" | "openrouter";
export type TextProviderType = "text" | "embedding";

export interface TestTextProviderConnectionInput {
  kind: TextProviderKind;
  providerType: TextProviderType;
  baseUrl: string;
  apiKeySecretId?: number;
}

export interface TextProviderModelDetails {
  parentModel: string;
  format: string;
  family: string;
  families: string[] | null;
  parameterSize: string;
  quantizationLevel: string;
  contextLength?: number;
  maxCompletionTokens?: number;
  inputModalities?: string[];
  outputModalities?: string[];
  tokenizer?: string;
  instructType?: string | null;
  isModerated?: boolean;
  doesNotTrain?: boolean;
  zeroDataRetention?: boolean;
  promptPrice?: string;
  completionPrice?: string;
  requestPrice?: string;
  supportedParameters?: string[];
  description?: string;
}

export interface TextProviderLimits {
  limit: number | null;
  limitRemaining: number | null;
  limitReset: string | null;
  usage: number;
  usageDaily: number;
  usageWeekly: number;
  usageMonthly: number;
  isFreeTier: boolean;
  expiresAt: string | null;
}

export interface TextProviderGenerationSettings {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
}

export interface TextProviderModelInfo {
  id: string;
  name: string;
  modifiedAt: string;
  size: number;
  digest: string;
  details: TextProviderModelDetails;
}

export interface TextProviderConfig {
  id: number;
  kind: TextProviderKind;
  providerType: TextProviderType;
  name: string;
  baseUrl: string;
  apiKeySecretId: number | null;
  enabled: boolean;
  checkedAt: string;
  limits: TextProviderLimits | null;
  generationSettings: TextProviderGenerationSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TextProviderModel extends Omit<TextProviderModelInfo, "id"> {
  id: number;
  remoteId: string;
  providerId: number;
  enabled: boolean;
}

export interface TextProviderSnapshot {
  providers: TextProviderConfig[];
  models: TextProviderModel[];
}

export interface UpsertTextProviderInput extends TestTextProviderConnectionInput {
  id?: number;
  name: string;
  enabled: boolean;
  enabledModelIds: string[];
  generationSettings: TextProviderGenerationSettings;
}

export interface TestTextProviderConnectionResult {
  models: TextProviderModelInfo[];
  checkedAt: string;
  limits: TextProviderLimits | null;
}

export interface TextProviderApi {
  getSnapshot(): Promise<TextProviderSnapshot>;
  testConnection(
    input: TestTextProviderConnectionInput,
  ): Promise<TestTextProviderConnectionResult>;
  upsertProvider(input: UpsertTextProviderInput): Promise<TextProviderSnapshot>;
  deleteProvider(id: number): Promise<TextProviderSnapshot>;
}

export const TEXT_PROVIDER_IPC_CHANNELS = {
  getSnapshot: "text-providers:get-snapshot",
  testConnection: "text-providers:test-connection",
  upsertProvider: "text-providers:upsert",
  deleteProvider: "text-providers:delete",
} as const;
