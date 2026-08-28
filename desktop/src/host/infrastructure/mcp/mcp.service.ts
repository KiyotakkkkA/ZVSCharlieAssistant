import {
  createMCPClient,
  type MCPClient,
  type MCPClientConfig,
  type MCPTransport,
} from "@ai-sdk/mcp";
import type { ToolSet } from "ai";

type McpUrlTransportConfig = Extract<
  MCPClientConfig["transport"],
  { type: string }
>;
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  isMcpStdioServerConfig,
  type McpServerConfig,
} from "../../../shared/dto";
import type {
  McpServerState,
  McpServerStatus,
  McpServerToolSummary,
  McpSnapshot,
  McpTransportKind,
} from "../../../shared/models/mcp";
import type { AutomationTool } from "../../../shared/models/automation";
import { McpConfigStore } from "./mcp-config.store";

const MCP_TOOL_ID_PREFIX = "mcp__";

interface ServerEntry {
  config: McpServerConfig;
  client: MCPClient | null;
  toolSet: ToolSet;
  state: McpServerState;
}

export class McpService {
  private readonly servers = new Map<string, ServerEntry>();
  private configError: string | null = null;
  private listener?: (snapshot: McpSnapshot) => void;
  private revalidating: Promise<McpSnapshot> | null = null;

  constructor(private readonly configStore: McpConfigStore) {}

  get configPath(): string {
    return this.configStore.filePath;
  }

  watch(listener: (snapshot: McpSnapshot) => void): void {
    this.listener = listener;
  }

  snapshot(): McpSnapshot {
    return {
      servers: [...this.servers.values()].map((entry) => entry.state),
      configPath: this.configStore.filePath,
      configError: this.configError,
    };
  }

  getAutomationTools(): AutomationTool[] {
    const result: AutomationTool[] = [];
    for (const [serverId, entry] of this.servers) {
      const connected = entry.state.status === "connected";
      const disabledReason = connected
        ? null
        : `MCP-сервер «${serverId}» ${entry.state.status === "connecting" ? "ещё подключается" : entry.state.status === "disabled" ? "отключён в конфигурации" : "недоступен"}`;
      for (const tool of entry.state.tools) {
        result.push({
          id: mcpToolId(serverId, tool.name),
          name: tool.name,
          description: tool.description ?? "",
          category: `MCP: ${serverId}`,
          builtin: false,
          enabled: connected,
          disabledReason,
          requiresConfirmation: true,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema ?? {},
          secretRequirements: [],
          secretBindings: [],
        });
      }
    }
    return result;
  }

  getToolSet(): ToolSet {
    const merged: ToolSet = {};
    for (const [serverId, entry] of this.servers) {
      if (entry.state.status !== "connected") continue;
      for (const [toolName, tool] of Object.entries(entry.toolSet))
        merged[mcpToolId(serverId, toolName)] = tool;
    }
    return merged;
  }

  isMcpToolId(id: string): boolean {
    return id.startsWith(MCP_TOOL_ID_PREFIX);
  }

  async revalidate(): Promise<McpSnapshot> {
    if (this.revalidating) return this.revalidating;
    this.revalidating = this.doRevalidate().finally(() => {
      this.revalidating = null;
    });
    return this.revalidating;
  }

  private async doRevalidate(): Promise<McpSnapshot> {
    await Promise.all(
      [...this.servers.values()].map((entry) =>
        entry.client?.close().catch(() => {}),
      ),
    );
    this.servers.clear();

    const { config, error } = this.configStore.load();
    this.configError = error;
    for (const [id, serverConfig] of Object.entries(config.mcpServers)) {
      this.servers.set(id, {
        config: serverConfig,
        client: null,
        toolSet: {},
        state: {
          id,
          transport: transportKind(serverConfig),
          status: serverConfig.disabled ? "disabled" : "connecting",
          error: null,
          tools: [],
          connectedAt: null,
        },
      });
    }
    this.emit();

    await Promise.all(
      [...this.servers.entries()].map(([id, entry]) =>
        entry.config.disabled ? undefined : this.connectOne(id, entry),
      ),
    );
    return this.snapshot();
  }

  private async connectOne(id: string, entry: ServerEntry): Promise<void> {
    try {
      const client = await createMCPClient({
        transport: buildTransport(entry.config),
        clientName: "zvs-charlie-assistant",
      });
      const [listed, toolSet] = await Promise.all([
        client.listTools(),
        client.tools(),
      ]);
      entry.client = client;
      entry.toolSet = toolSet as ToolSet;
      entry.state = {
        ...entry.state,
        status: "connected",
        error: null,
        connectedAt: new Date().toISOString(),
        tools: listed.tools.map(
          (tool): McpServerToolSummary => ({
            name: tool.name,
            description: tool.description ?? null,
            inputSchema: tool.inputSchema as Record<string, unknown>,
            outputSchema:
              (tool.outputSchema as Record<string, unknown>) ?? null,
          }),
        ),
      };
    } catch (error) {
      entry.state = {
        ...entry.state,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    this.emit(id);
  }

  private emit(_changedId?: string): void {
    this.listener?.(this.snapshot());
  }
}

function mcpToolId(serverId: string, toolName: string): string {
  return `${MCP_TOOL_ID_PREFIX}${serverId}__${toolName}`;
}

function transportKind(config: McpServerConfig): McpTransportKind {
  if (isMcpStdioServerConfig(config)) return "stdio";
  return config.type;
}

function buildTransport(
  config: McpServerConfig,
): MCPTransport | McpUrlTransportConfig {
  if (isMcpStdioServerConfig(config)) {
    return new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
      cwd: config.cwd,
    }) as unknown as MCPTransport;
  }
  return {
    type: config.type,
    url: config.url,
    headers: config.headers,
  };
}

export type { McpServerStatus };
