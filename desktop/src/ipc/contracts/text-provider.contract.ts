export type TextProviderKind = "ollama";

export interface TestTextProviderConnectionInput {
  kind: TextProviderKind;
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

export interface TestTextProviderConnectionResult {
  models: TextProviderModelInfo[];
  checkedAt: string;
}

export interface TextProviderApi {
  testConnection(
    input: TestTextProviderConnectionInput,
  ): Promise<TestTextProviderConnectionResult>;
}

export const TEXT_PROVIDER_IPC_CHANNELS = {
  testConnection: "text-providers:test-connection",
} as const;
