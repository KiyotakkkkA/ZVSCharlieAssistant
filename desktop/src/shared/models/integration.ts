import type {
  IntegrationKind,
  IntegrationStatus,
  UpsertIntegrationProfileInput,
} from "../dto/integration.dto";

export interface IntegrationProfile
  extends Omit<UpsertIntegrationProfileInput, "id"> {
  id: number;
  status: IntegrationStatus;
  checkedAt: string | null;
  lastError: string | null;
  connectionMetadata: IntegrationConnectionMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSnapshot {
  profiles: IntegrationProfile[];
}

export interface IntegrationConnectionResult {
  ok: boolean;
  identity?: string;
  metadata?: IntegrationConnectionMetadata;
  error?: string;
}

export interface IntegrationConnectionMetadata {
  identity?: string;
  telegram?: {
    id: number;
    username?: string;
    firstName?: string;
    canJoinGroups?: boolean;
  };
}

export type { IntegrationKind, IntegrationStatus };
