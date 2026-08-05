import type {
  TextProviderGenerationSettings,
  TextProviderKind,
  TextProviderLimits,
  TextProviderModelDetails,
  TextProviderType,
} from "../dto";
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
export interface TestTextProviderConnectionResult {
  models: TextProviderModelInfo[];
  checkedAt: string;
  limits: TextProviderLimits | null;
}
