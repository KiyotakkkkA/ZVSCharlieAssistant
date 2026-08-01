import type {
  TextProviderModelInfo,
  TextProviderSnapshot,
  UpsertTextProviderInput,
} from "../../../ipc/contracts/text-provider.contract";

export interface TextProviderRepository {
  getSnapshot(): TextProviderSnapshot;
  upsert(
    input: UpsertTextProviderInput,
    id: number | undefined,
    checkedAt: string,
    models: TextProviderModelInfo[],
  ): TextProviderSnapshot;
  delete(id: number): TextProviderSnapshot;
}
