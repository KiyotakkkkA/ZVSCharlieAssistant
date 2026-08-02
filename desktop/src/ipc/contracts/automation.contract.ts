export type AutomationStatus = "draft" | "active" | "disabled";

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
}

export interface AgentSecretBinding {
  secretId: number;
  allowedToolIds: string[];
}

export interface AutomationAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  textModelId: number | null;
  status: AutomationStatus;
  allowedToolIds: string[];
  secretBindings: AgentSecretBinding[];
  requireDangerousActionConfirmation: boolean;
  maxToolCalls: number;
  timeoutSeconds: number;
  runs: number;
  updatedAt: string;
}

export interface UpsertAutomationAgentInput {
  id?: string;
  name: string;
  description: string;
  instructions: string;
  textModelId: number;
  status: AutomationStatus;
  allowedToolIds: string[];
  secretBindings: AgentSecretBinding[];
  requireDangerousActionConfirmation: boolean;
  maxToolCalls: number;
  timeoutSeconds: number;
}

export type AutomationScenarioNodeKind =
  | "trigger"
  | "orchestrator"
  | "agent"
  | "condition"
  | "approval"
  | "output";

export interface AutomationScenarioNode {
  id: string;
  kind: AutomationScenarioNodeKind;
  title: string;
  description: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
}

export interface AutomationScenarioEdge {
  id: string;
  kind: "control" | "worker";
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  condition?: Record<string, unknown>;
}

export interface AutomationScenarioGraph {
  nodes: AutomationScenarioNode[];
  edges: AutomationScenarioEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface AutomationScenarioToolSetting {
  toolId: string;
  settings: Record<string, unknown>;
}

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

export type ScenarioRunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type ScenarioRunOrigin = "manual" | "chat" | "background";

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

export interface UpsertAutomationScenarioInput {
  id?: string;
  name: string;
  description: string;
  status: AutomationStatus;
  graph: AutomationScenarioGraph;
  toolSettings: AutomationScenarioToolSetting[];
}

export interface AutomationSnapshot {
  tools: AutomationTool[];
  agents: AutomationAgent[];
  scenarios: AutomationScenario[];
}

export interface AutomationApi {
  getSnapshot(): Promise<AutomationSnapshot>;
  upsertAgent(input: UpsertAutomationAgentInput): Promise<AutomationAgent>;
  deleteAgent(id: string): Promise<void>;
  upsertScenario(
    input: UpsertAutomationScenarioInput,
  ): Promise<AutomationScenario>;
  deleteScenario(id: string): Promise<void>;
  validateScenario(graph: AutomationScenarioGraph): Promise<ScenarioValidationResult>;
  startScenario(id: string, input: unknown, origin?: ScenarioRunOrigin): Promise<ScenarioRun>;
  cancelScenarioRun(id: number): Promise<void>;
  approveScenarioRun(id: number, approved: boolean): Promise<void>;
  getScenarioRun(id: number): Promise<{ run: ScenarioRun; nodes: ScenarioNodeRun[] }>;
  subscribeScenarioRuns(listener: (event: ScenarioRunEvent) => void): () => void;
}

export const AUTOMATION_IPC_CHANNELS = {
  getSnapshot: "automation:get-snapshot",
  upsertAgent: "automation:upsert-agent",
  deleteAgent: "automation:delete-agent",
  upsertScenario: "automation:upsert-scenario",
  deleteScenario: "automation:delete-scenario",
  validateScenario: "automation:validate-scenario",
  startScenario: "automation:start-scenario",
  cancelScenarioRun: "automation:cancel-scenario-run",
  approveScenarioRun: "automation:approve-scenario-run",
  getScenarioRun: "automation:get-scenario-run",
  scenarioRunEvent: "automation:scenario-run-event",
} as const;
