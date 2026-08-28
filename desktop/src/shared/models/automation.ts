import type { RunOrigin, RunStatus } from "./run";
import type {
  AgentTerminalPolicy,
  AgentDirectoryPolicy,
  AutomationScenarioGraph,
  AutomationScenarioToolSetting,
  AutomationStatus,
} from "../dto";

export interface AutomationToolSecretRequirement {
  key: string;
  label: string;
  categoryId: string;
  required: boolean;
}
export interface AutomationToolSecretBinding {
  key: string;
  secretId: string;
}
export interface AutomationTool {
  id: string;
  name: string;
  description: string;
  category: string;
  builtin: boolean;
  internal?: boolean;
  enabled: boolean;
  disabledReason?: string | null;
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
  textModelId: string | null;
  status: AutomationStatus;
  allowedToolIds: string[];
  allowedVectorStoreIds: string[];
  allowedSkillIds: string[];
  memoryRead: boolean;
  memoryWrite: boolean;
  retrievalLimit: number;
  maxToolCalls: number;
  timeoutSeconds: number;
  terminalPolicy: AgentTerminalPolicy;
  directoryPolicy: AgentDirectoryPolicy;
  runs: number;
  updatedAt: string;
}
export interface AutomationSkill {
  id: string;
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
export type AutomationScenarioNodeKind = string;
export interface AutomationScenario {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  graph: AutomationScenarioGraph;
  toolSettings: AutomationScenarioToolSetting[];
  revisionId: string;
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
  id: string;
  scenarioId: string;
  scenarioRevisionId: string;
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
  id: string;
  executionId: string;
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
  | { type: "node.started"; runId: string; node: ScenarioNodeRun }
  | { type: "node.output.delta"; runId: string; nodeId: string; delta: string }
  | { type: "approval.required"; runId: string; nodeId: string; prompt: string }
  | {
      type: "run.suspended";
      runId: string;
      nodeId: string;
      questionId: string;
    }
  | { type: "node.completed"; runId: string; node: ScenarioNodeRun }
  | { type: "run.completed"; run: ScenarioRun }
  | { type: "run.failed"; run: ScenarioRun }
  | { type: "run.cancelled"; run: ScenarioRun };
export type {
  ScenarioValidationResult,
  ScenarioValidationIssue,
} from "../scenario/graph";
