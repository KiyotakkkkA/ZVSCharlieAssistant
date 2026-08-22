import type {
  TestTextProviderConnectionResult,
  TextProviderSnapshot,
} from "../../shared/models/text-provider";
import type {
  TestTextProviderConnectionInput,
  UpsertTextProviderInput,
} from "../../shared/dto";

export interface TextProviderApi {
  getSnapshot(): Promise<TextProviderSnapshot>;
  testConnection(
    input: TestTextProviderConnectionInput,
  ): Promise<TestTextProviderConnectionResult>;
  upsertProvider(input: UpsertTextProviderInput): Promise<TextProviderSnapshot>;
  deleteProvider(id: string): Promise<TextProviderSnapshot>;
}

export const TEXT_PROVIDER_IPC_CHANNELS = {
  getSnapshot: "text-providers:get-snapshot",
  testConnection: "text-providers:test-connection",
  upsertProvider: "text-providers:upsert",
  deleteProvider: "text-providers:delete",
} as const;
