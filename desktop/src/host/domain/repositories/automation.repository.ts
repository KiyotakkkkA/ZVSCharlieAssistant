import type {
  AutomationAgent,
  AutomationScenario,
  AutomationSnapshot,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
} from "../../../ipc/contracts";

export interface AutomationRepository {
  getSnapshot(): AutomationSnapshot;
  upsertAgent(input: UpsertAutomationAgentInput): AutomationAgent;
  deleteAgent(id: string): void;
  upsertScenario(input: UpsertAutomationScenarioInput): AutomationScenario;
  deleteScenario(id: string): void;
}
