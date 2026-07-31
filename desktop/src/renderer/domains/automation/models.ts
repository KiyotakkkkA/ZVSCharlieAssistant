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
  model: string;
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
  model: string;
  status: AutomationStatus;
  allowedToolIds: string[];
  secretBindings: AgentSecretBinding[];
  requireDangerousActionConfirmation: boolean;
  maxToolCalls: number;
  timeoutSeconds: number;
}

export interface AutomationScenario {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  nodesCount: number;
  lastRunAt: string | null;
  updatedAt: string;
}

export interface UpsertAutomationScenarioInput {
  id?: string;
  name: string;
  description: string;
  status: AutomationStatus;
  nodesCount: number;
}

export interface AutomationSnapshot {
  tools: AutomationTool[];
  agents: AutomationAgent[];
  scenarios: AutomationScenario[];
}
