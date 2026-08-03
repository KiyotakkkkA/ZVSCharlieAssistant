import type {
  AutomationAgent,
  AutomationScenario,
  AutomationSkill,
  AutomationSnapshot,
  AutomationTool,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  UpsertAutomationSkillInput,
  UpsertAutomationToolSecretBindingInput,
} from "../../domain/models/automation";

export interface AutomationRepository {
  getSnapshot(): AutomationSnapshot;
  upsertAgent(input: UpsertAutomationAgentInput): AutomationAgent;
  deleteAgent(id: string): void;
  upsertSkill(input: UpsertAutomationSkillInput): AutomationSkill;
  deleteSkill(id: number): void;
  upsertToolSecretBinding(
    input: UpsertAutomationToolSecretBindingInput,
  ): AutomationTool;
  upsertScenario(input: UpsertAutomationScenarioInput): AutomationScenario;
  deleteScenario(id: string): void;
}
