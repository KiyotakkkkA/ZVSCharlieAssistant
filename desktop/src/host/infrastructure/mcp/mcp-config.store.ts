import { readFileSync, writeFileSync } from "node:fs";
import { mcpConfigFileSchema, type McpConfigFile } from "../../../shared/dto";

const DEFAULT_CONFIG_CONTENT = `{\n  "mcpServers": {}\n}\n`;

export interface McpConfigLoadResult {
  config: McpConfigFile;
  error: string | null;
}

export class McpConfigStore {
  constructor(private readonly path: string) {}

  get filePath(): string {
    return this.path;
  }

  load(): McpConfigLoadResult {
    let raw: string;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch (error) {
      if (isMissingFileError(error)) {
        writeFileSync(this.path, DEFAULT_CONFIG_CONTENT, {
          encoding: "utf8",
          flush: true,
        });
        return { config: { mcpServers: {} }, error: null };
      }
      return {
        config: { mcpServers: {} },
        error: error instanceof Error ? error.message : String(error),
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch (error) {
      return {
        config: { mcpServers: {} },
        error: `Файл конфигурации MCP повреждён: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const parsed = mcpConfigFileSchema.safeParse(json);
    if (!parsed.success)
      return {
        config: { mcpServers: {} },
        error: `Файл конфигурации MCP не соответствует формату: ${parsed.error.issues[0]?.message ?? "неизвестная ошибка"}`,
      };
    return { config: parsed.data, error: null };
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
