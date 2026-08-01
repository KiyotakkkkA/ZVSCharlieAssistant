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
  textModelId: string | null;
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
  textModelId: string;
  status: AutomationStatus;
  allowedToolIds: string[];
  secretBindings: AgentSecretBinding[];
  requireDangerousActionConfirmation: boolean;
  maxToolCalls: number;
  timeoutSeconds: number;
}

export type AutomationScenarioNodeKind =
  | "trigger"
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
  source: string;
  target: string;
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
  nodesCount: number;
  lastRunAt: string | null;
  updatedAt: string;
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
}

export const AUTOMATION_IPC_CHANNELS = {
  getSnapshot: "automation:get-snapshot",
  upsertAgent: "automation:upsert-agent",
  deleteAgent: "automation:delete-agent",
  upsertScenario: "automation:upsert-scenario",
  deleteScenario: "automation:delete-scenario",
} as const;
