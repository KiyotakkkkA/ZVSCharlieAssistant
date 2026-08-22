import type { RunStatus } from "./run";

export type GeneratedEntityKind = "agent" | "skill";
export type EntityGenerationStatus = RunStatus;

export interface EntityGenerationRun {
  id: string;
  kind: GeneratedEntityKind;
  modelId: string;
  prompt: string;
  status: EntityGenerationStatus;
  entityId: string | null;
  entityName: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
