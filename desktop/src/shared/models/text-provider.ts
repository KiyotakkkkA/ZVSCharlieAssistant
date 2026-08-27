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
  id: string;
  kind: TextProviderKind;
  providerType: TextProviderType;
  name: string;
  baseUrl: string;
  apiKeySecretId: string | null;
  enabled: boolean;
  checkedAt: string;
  limits: TextProviderLimits | null;
  generationSettings: TextProviderGenerationSettings;
  createdAt: string;
  updatedAt: string;
}
export interface TextProviderModel extends Omit<TextProviderModelInfo, "id"> {
  id: string;
  remoteId: string;
  providerId: string;
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

export function enabledTextProviderModels(
  snapshot: Pick<TextProviderSnapshot, "providers" | "models">,
): TextProviderModel[] {
  const providerIds = new Set(
    snapshot.providers
      .filter(
        (provider) => provider.enabled && provider.providerType === "text",
      )
      .map((provider) => provider.id),
  );
  return snapshot.models.filter(
    (model) => model.enabled && providerIds.has(model.providerId),
  );
}
