import type {
  AutomationAgent,
  AutomationScenario,
  AutomationSkill,
  AutomationSnapshot,
  AutomationTool,
} from "../../../shared/models/automation";
import type {
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  UpsertAutomationSkillInput,
  UpsertAutomationToolSecretBindingInput,
} from "../../../shared/dto";

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
