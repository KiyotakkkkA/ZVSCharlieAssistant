import type { RunStatus } from "./run";

export type GeneratedEntityKind = "agent" | "skill";
export type EntityGenerationStatus = RunStatus;

export interface EntityGenerationRun {
  id: number;
  kind: GeneratedEntityKind;
  modelId: number;
  prompt: string;
  status: EntityGenerationStatus;
  entityId: string | null;
  entityName: string | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
