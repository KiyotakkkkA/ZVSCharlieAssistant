import type {
  TextProviderModelInfo,
  TextProviderLimits,
  TextProviderSnapshot,
  UpsertTextProviderInput,
} from "../../domain/models/text-provider";

export interface TextProviderRepository {
  getSnapshot(): TextProviderSnapshot;
  upsert(
    input: UpsertTextProviderInput,
    id: number | undefined,
    checkedAt: string,
    models: TextProviderModelInfo[],
    limits: TextProviderLimits | null,
  ): TextProviderSnapshot;
  delete(id: number): TextProviderSnapshot;
}
