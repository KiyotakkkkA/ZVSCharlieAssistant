import type {
  EntityGenerationRun,
  GenerationRunEvent,
  GenerationTranscriptMessage,
} from "../../shared/models/entity-generation";
import type { StartEntityGenerationInput } from "../../shared/dto";

export type * from "../../shared/models/entity-generation";

export interface EntityGenerationApi {
  list(): Promise<EntityGenerationRun[]>;
  start(input: StartEntityGenerationInput): Promise<EntityGenerationRun>;
  getTranscript(runId: string): Promise<GenerationTranscriptMessage[]>;
  subscribeRunEvents(listener: (event: GenerationRunEvent) => void): () => void;
}

export const ENTITY_GENERATION_IPC_CHANNELS = {
  list: "entity-generation:list",
  start: "entity-generation:start",
  getTranscript: "entity-generation:get-transcript",
  runEvent: "entity-generation:run-event",
} as const;
