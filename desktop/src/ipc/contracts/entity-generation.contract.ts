import type { EntityGenerationRun } from "../../shared/models/entity-generation";
import type { StartEntityGenerationInput } from "../../shared/dto";

export type * from "../../shared/models/entity-generation";

export interface EntityGenerationApi {
  list(): Promise<EntityGenerationRun[]>;
  start(input: StartEntityGenerationInput): Promise<EntityGenerationRun>;
}

export const ENTITY_GENERATION_IPC_CHANNELS = {
  list: "entity-generation:list",
  start: "entity-generation:start",
} as const;
