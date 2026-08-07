import type {
  IntegrationKind,
  UpsertIntegrationProfileInput,
} from "../dto/integration.dto";
import { ProvidedEntityStatus } from "../dto/shared";

export interface IntegrationProfile extends Omit<
  UpsertIntegrationProfileInput,
  "id"
> {
  id: number;
  status: ProvidedEntityStatus;
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
  repository?: {
    fullName: string;
    webUrl: string;
    description?: string;
    visibility?: string;
    defaultBranch?: string;
    branches: string[];
    language?: string;
    stars?: number;
    forks?: number;
    openIssues?: number;
    updatedAt?: string;
  };
}

export type { IntegrationKind };
