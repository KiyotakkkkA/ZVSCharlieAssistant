import type {
  TextProviderModelInfo,
  TextProviderSnapshot,
} from "../../../shared/models/text-provider";
import type {
  TextProviderLimits,
  UpsertTextProviderInput,
} from "../../../shared/dto";

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
