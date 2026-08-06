import type {
  IntegrationConnectionResult,
  IntegrationProfile,
  IntegrationSnapshot,
} from "../../shared/models/integration";
import type { UpsertIntegrationProfileInput } from "../../shared/dto";

export interface IntegrationApi {
  getSnapshot(): Promise<IntegrationSnapshot>;
  upsert(input: UpsertIntegrationProfileInput): Promise<IntegrationProfile>;
  delete(id: number): Promise<void>;
  test(input: UpsertIntegrationProfileInput): Promise<IntegrationConnectionResult>;
}

export const INTEGRATION_IPC_CHANNELS = {
  getSnapshot: "integrations:get-snapshot",
  upsert: "integrations:upsert",
  delete: "integrations:delete",
  test: "integrations:test",
} as const;
