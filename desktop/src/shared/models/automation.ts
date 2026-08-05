import type { RunOrigin, RunStatus } from "./run";
import type { ScenarioNodeKind } from "../scenario-ports";
import type {
  AgentTerminalPolicy,
  AutomationScenarioGraph,
  AutomationScenarioToolSetting,
  AutomationStatus,
} from "../dto";

export interface AutomationToolSecretRequirement {
  key: string;
  label: string;
  categoryId: number;
  required: boolean;
}
export interface AutomationToolSecretBinding {
  key: string;
  secretId: number;
}
export interface AutomationTool {
  id: string;
  name: string;
  description: string;
  category: string;
  builtin: true;
  enabled: boolean;
  requiresConfirmation: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  secretRequirements: AutomationToolSecretRequirement[];
  secretBindings: AutomationToolSecretBinding[];
}
export interface AutomationAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  textModelId: number | null;
  status: AutomationStatus;
  allowedToolIds: string[];
  allowedVectorStoreIds: number[];
  allowedSkillIds: number[];
  retrievalLimit: number;
  maxToolCalls: number;
  timeoutSeconds: number;
  terminalPolicy: AgentTerminalPolicy;
  runs: number;
  updatedAt: string;
}
export interface AutomationSkill {
  id: number;
  slug: string;
  name: string;
  description: string;
  status: AutomationStatus;
  version: string;
  author: string;
  instructions: string;
  requiredToolIds: string[];
  assignedAgentsCount: number;
  builtin: boolean;
  updatedAt: string;
}
export type AutomationScenarioNodeKind = ScenarioNodeKind;
export interface AutomationScenario {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  graph: AutomationScenarioGraph;
  toolSettings: AutomationScenarioToolSetting[];
  revisionId: number;
  version: number;
  nodesCount: number;
  lastRunAt: string | null;
  updatedAt: string;
}
export interface AutomationSnapshot {
  tools: AutomationTool[];
  agents: AutomationAgent[];
  scenarios: AutomationScenario[];
  skills: AutomationSkill[];
}
export type ScenarioRunStatus = RunStatus;
export type ScenarioRunOrigin = RunOrigin;
export interface ScenarioRun {
  id: number;
  scenarioId: string;
  scenarioRevisionId: number;
  scenarioName: string;
  origin: ScenarioRunOrigin;
  status: ScenarioRunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
export interface ScenarioNodeRun {
  id: number;
  executionId: number;
  nodeId: string;
  nodeKind: AutomationScenarioNodeKind;
  attempt: number;
  status: ScenarioRunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}
export type ScenarioRunEvent =
  | { type: "run.started"; run: ScenarioRun }
  | { type: "node.started"; runId: number; node: ScenarioNodeRun }
  | { type: "node.output.delta"; runId: number; nodeId: string; delta: string }
  | { type: "approval.required"; runId: number; nodeId: string; prompt: string }
  | { type: "node.completed"; runId: number; node: ScenarioNodeRun }
  | { type: "run.completed"; run: ScenarioRun }
  | { type: "run.failed"; run: ScenarioRun }
  | { type: "run.cancelled"; run: ScenarioRun };
export interface ScenarioValidationResult {
  valid: boolean;
  issues: Array<{ nodeId?: string; message: string }>;
}
