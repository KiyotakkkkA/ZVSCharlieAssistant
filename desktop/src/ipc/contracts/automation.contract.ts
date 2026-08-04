import type {
  AutomationAgent,
  AutomationScenario,
  AutomationScenarioGraph,
  AutomationSkill,
  AutomationSnapshot,
  AutomationTool,
  ScenarioNodeRun,
  ScenarioRun,
  ScenarioRunEvent,
  ScenarioRunOrigin,
  ScenarioValidationResult,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput,
  UpsertAutomationSkillInput,
  UpsertAutomationToolSecretBindingInput,
} from "../../shared/models/automation";

export type * from "../../shared/models/automation";

export interface AutomationApi {
  getSnapshot(): Promise<AutomationSnapshot>;
  upsertAgent(input: UpsertAutomationAgentInput): Promise<AutomationAgent>;
  deleteAgent(id: string): Promise<void>;
  upsertSkill(input: UpsertAutomationSkillInput): Promise<AutomationSkill>;
  deleteSkill(id: number): Promise<void>;
  upsertToolSecretBinding(
    input: UpsertAutomationToolSecretBindingInput,
  ): Promise<AutomationTool>;
  upsertScenario(
    input: UpsertAutomationScenarioInput,
  ): Promise<AutomationScenario>;
  deleteScenario(id: string): Promise<void>;
  validateScenario(
    graph: AutomationScenarioGraph,
  ): Promise<ScenarioValidationResult>;
  startScenario(
    id: string,
    input: unknown,
    origin?: ScenarioRunOrigin,
  ): Promise<ScenarioRun>;
  cancelScenarioRun(id: number): Promise<void>;
  approveScenarioRun(id: number, approved: boolean): Promise<void>;
  getScenarioRun(
    id: number,
  ): Promise<{ run: ScenarioRun; nodes: ScenarioNodeRun[] }>;
  subscribeScenarioRuns(
    listener: (event: ScenarioRunEvent) => void,
  ): () => void;
}

export const AUTOMATION_IPC_CHANNELS = {
  getSnapshot: "automation:get-snapshot",
  upsertAgent: "automation:upsert-agent",
  deleteAgent: "automation:delete-agent",
  upsertSkill: "automation:upsert-skill",
  deleteSkill: "automation:delete-skill",
  upsertToolSecretBinding: "automation:upsert-tool-secret-binding",
  upsertScenario: "automation:upsert-scenario",
  deleteScenario: "automation:delete-scenario",
  validateScenario: "automation:validate-scenario",
  startScenario: "automation:start-scenario",
  cancelScenarioRun: "automation:cancel-scenario-run",
  approveScenarioRun: "automation:approve-scenario-run",
  getScenarioRun: "automation:get-scenario-run",
  scenarioRunEvent: "automation:scenario-run-event",
} as const;
