import type { McpSnapshot } from "../../shared/models/mcp";

export type * from "../../shared/models/mcp";

export interface McpApi {
  getSnapshot(): Promise<McpSnapshot>;
  revalidate(): Promise<McpSnapshot>;
  openConfigFolder(): Promise<void>;
  subscribe(listener: (snapshot: McpSnapshot) => void): () => void;
}

export const MCP_IPC_CHANNELS = {
  getSnapshot: "mcp:get-snapshot",
  revalidate: "mcp:revalidate",
  openConfigFolder: "mcp:open-config-folder",
  snapshotChanged: "mcp:snapshot-changed",
} as const;
