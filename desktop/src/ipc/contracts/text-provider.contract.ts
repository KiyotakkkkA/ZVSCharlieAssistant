export type TextProviderKind = "ollama";
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
}

export interface TestTextProviderConnectionResult {
  models: TextProviderModelInfo[];
  checkedAt: string;
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
