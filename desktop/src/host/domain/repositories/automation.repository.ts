import type {
  AutomationAgent,
  AutomationScenario,
  AutomationSnapshot,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  UpsertAutomationToolSecretBindingInput,
  AutomationTool,
  AutomationSkill,
  UpsertAutomationSkillInput,
} from "../../../ipc/contracts";

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
