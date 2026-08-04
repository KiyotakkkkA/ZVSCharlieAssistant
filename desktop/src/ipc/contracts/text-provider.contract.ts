import type {
  TestTextProviderConnectionInput,
  TestTextProviderConnectionResult,
  TextProviderSnapshot,
  UpsertTextProviderInput,
} from "../../shared/models/text-provider";

export type * from "../../shared/models/text-provider";

export interface TextProviderApi {
  getSnapshot(): Promise<TextProviderSnapshot>;
  testConnection(input: TestTextProviderConnectionInput): Promise<TestTextProviderConnectionResult>;
  upsertProvider(input: UpsertTextProviderInput): Promise<TextProviderSnapshot>;
  deleteProvider(id: number): Promise<TextProviderSnapshot>;
}

export const TEXT_PROVIDER_IPC_CHANNELS = {
  getSnapshot: "text-providers:get-snapshot",
  testConnection: "text-providers:test-connection",
  upsertProvider: "text-providers:upsert",
  deleteProvider: "text-providers:delete",
} as const;
