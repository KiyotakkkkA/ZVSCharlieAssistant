import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { McpConfigStore } from "../../src/host/infrastructure/mcp/mcp-config.store";

let directory: string | undefined;

afterEach(() => {
  if (!directory) return;
  const target = resolve(directory);
  const temporaryRoot = resolve(tmpdir());
  const relativePath = relative(temporaryRoot, target);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`Refusing to remove a non-temporary path: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
  directory = undefined;
});

function configPath(): string {
  directory = mkdtempSync(join(tmpdir(), "zvs-mcp-config-"));
  return join(directory, "mcp.json");
}

describe("McpConfigStore", () => {
  it("creates a default empty config file when none exists", () => {
    const path = configPath();
    const store = new McpConfigStore(path);

    const result = store.load();

    expect(result.error).toBeNull();
    expect(result.config).toEqual({ mcpServers: {} });
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ mcpServers: {} });
  });

  it("parses stdio and remote server configs in the common mcpServers format", () => {
    const path = configPath();
    writeFileSync(
      path,
      JSON.stringify({
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
          },
          remote: {
            url: "https://example.com/mcp",
            type: "sse",
          },
        },
      }),
    );
    const store = new McpConfigStore(path);

    const result = store.load();

    expect(result.error).toBeNull();
    expect(result.config.mcpServers.filesystem).toMatchObject({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      disabled: false,
    });
    expect(result.config.mcpServers.remote).toMatchObject({
      url: "https://example.com/mcp",
      type: "sse",
      disabled: false,
    });
  });

  it("reports a readable error for malformed JSON instead of throwing", () => {
    const path = configPath();
    writeFileSync(path, "{ not valid json");
    const store = new McpConfigStore(path);

    const result = store.load();

    expect(result.config).toEqual({ mcpServers: {} });
    expect(result.error).toContain("повреждён");
  });

  it("reports a readable error when the shape doesn't match the schema", () => {
    const path = configPath();
    writeFileSync(
      path,
      JSON.stringify({ mcpServers: { broken: { foo: "bar" } } }),
    );
    const store = new McpConfigStore(path);

    const result = store.load();

    expect(result.config).toEqual({ mcpServers: {} });
    expect(result.error).toContain("не соответствует формату");
  });
});
