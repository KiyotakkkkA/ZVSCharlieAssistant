import type {
  AutomationSkill,
  AutomationStatus,
  UpsertAutomationSkillInput,
} from "../../domain/models/automation";

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
  toolSecretId(toolId: string, key: string): number | undefined;
}

export interface BuiltinSkillMetadataStore {
  ensureBuiltinSkill(
    input: Omit<UpsertAutomationSkillInput, "id" | "instructions">,
  ): number;
}

export interface BuiltinSkillDefinition {
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
    runId: number,
    providerCallId: string,
    toolId: string,
    risk: string,
    input: unknown,
    status: string,
  ): number;
  finishToolCall(
    id: number,
    status: string,
    output?: unknown,
    error?: string,
  ): void;
}
