import type {
  AutomationAgent,
  AutomationScenario,
  AutomationSnapshot,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  UpsertAutomationToolSecretBindingInput,
  AutomationTool,
} from "../../../ipc/contracts";

export interface AutomationRepository {
  getSnapshot(): AutomationSnapshot;
  upsertAgent(input: UpsertAutomationAgentInput): AutomationAgent;
  deleteAgent(id: string): void;
  upsertToolSecretBinding(
    input: UpsertAutomationToolSecretBindingInput,
  ): AutomationTool;
  upsertScenario(input: UpsertAutomationScenarioInput): AutomationScenario;
  deleteScenario(id: string): void;
}
