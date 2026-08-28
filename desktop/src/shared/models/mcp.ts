export type McpTransportKind = "stdio" | "http" | "sse";
export type McpServerStatus = "connecting" | "connected" | "error" | "disabled";

export interface McpServerToolSummary {
  name: string;
  description: string | null;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown> | null;
}

export interface McpServerState {
  id: string;
  transport: McpTransportKind;
  status: McpServerStatus;
  error: string | null;
  tools: McpServerToolSummary[];
  connectedAt: string | null;
}

export interface McpSnapshot {
  servers: McpServerState[];
  configPath: string;
  configError: string | null;
}
