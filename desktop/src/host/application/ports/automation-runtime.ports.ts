import type { AutomationSkill } from "../../../shared/models/automation";
import type {
  AutomationStatus,
  UpsertAutomationSkillInput,
} from "../../../shared/dto";

export interface SkillContentStore {
  read(slug: string): string;
  write(
    slug: string,
    metadata: { name: string; description: string },
    instructions: string,
  ): void;
  remove(slug: string): void;
}

export interface AutomationRuntimeCatalog {
  listSkills(): Array<Omit<AutomationSkill, "instructions">>;
  toolSecretId(toolId: string, key: string): string | undefined;
}

export interface BuiltinSkillMetadataStore {
  ensureBuiltinSkill(
    input: Omit<UpsertAutomationSkillInput, "instructions"> & { id: string },
  ): string;
}

export interface BuiltinSkillDefinition {
  id: string;
  slug: string;
  name: string;
  description: string;
  status?: AutomationStatus;
  version: string;
  author: string;
  requiredToolIds: string[];
  instructions: string;
}

export interface ToolCallRecorder {
  createToolCall(
    runId: string,
    providerCallId: string,
    toolId: string,
    risk: string,
    input: unknown,
    status: string,
  ): string;
  finishToolCall(
    id: string,
    status: string,
    output?: unknown,
    error?: string,
  ): void;
}
