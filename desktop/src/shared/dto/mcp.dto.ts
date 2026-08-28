import { z } from "zod";

const mcpStdioServerConfigSchema = z.object({
  command: z.string().trim().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  cwd: z.string().optional(),
  disabled: z.boolean().default(false),
});

const mcpRemoteServerConfigSchema = z.object({
  url: z.string().trim().url(),
  headers: z.record(z.string(), z.string()).optional(),
  type: z.enum(["http", "sse"]).default("http"),
  disabled: z.boolean().default(false),
});

export const mcpServerConfigSchema = z.union([
  mcpStdioServerConfigSchema,
  mcpRemoteServerConfigSchema,
]);

export const mcpConfigFileSchema = z.object({
  mcpServers: z.record(z.string(), mcpServerConfigSchema).default({}),
});

export type McpStdioServerConfig = z.infer<typeof mcpStdioServerConfigSchema>;
export type McpRemoteServerConfig = z.infer<typeof mcpRemoteServerConfigSchema>;
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type McpConfigFile = z.infer<typeof mcpConfigFileSchema>;

export function isMcpStdioServerConfig(
  config: McpServerConfig,
): config is McpStdioServerConfig {
  return "command" in config;
}
