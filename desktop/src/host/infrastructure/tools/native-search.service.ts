import { createRequire } from "node:module";
import { join } from "node:path";
import type { AgentDirectoryPolicy } from "../../../shared/dto";
import type { DirectoryPolicyDataSource } from "../database/directory-policy.data-source";

export interface EntitySearchInput {
  base: string;
  query: string;
  entityTypes?: Array<"file" | "directory">;
  matchMode?: "exact" | "contains" | "glob";
  includeHidden?: boolean;
  maxDepth?: number;
  limit?: number;
}

export interface RegexpSearchInput {
  base: string;
  target?: string;
  pattern: string;
  mode?: "regex" | "literal";
  caseSensitive?: boolean;
  wholeWord?: boolean;
  include?: string[];
  exclude?: string[];
  includeHidden?: boolean;
  maxFileBytes?: number;
  limit?: number;
}

interface NativeSearchAddon {
  entitySearch(input: EntitySearchInput & { allowedRoots: AllowedRoot[] }): Promise<unknown>;
  regexpSearch(input: RegexpSearchInput & { allowedRoots: AllowedRoot[] }): Promise<unknown>;
}

interface AllowedRoot {
  path: string;
  recursive: boolean;
}

export class NativeSearchService {
  private addon?: NativeSearchAddon;

  constructor(
    private readonly nativeRoot: string,
    private readonly policies: DirectoryPolicyDataSource,
  ) {}

  entitySearch(input: EntitySearchInput, policy: AgentDirectoryPolicy) {
    return this.load().entitySearch({ ...input, allowedRoots: this.readRoots(policy) });
  }

  regexpSearch(input: RegexpSearchInput, policy: AgentDirectoryPolicy) {
    return this.load().regexpSearch({ ...input, allowedRoots: this.readRoots(policy) });
  }

  private readRoots(policy: AgentDirectoryPolicy) {
    const requested = new Map(
      policy.grants.map((grant) => [grant.path.toLowerCase(), grant]),
    );
    const roots = this.policies
      .get()
      .grants.flatMap((global) => {
        const agent = requested.get(global.path.toLowerCase());
        if (
          !agent ||
          !global.permissions.includes("read") ||
          !agent.permissions.includes("read")
        )
          return [];
        return [
          {
            path: global.path,
            recursive: global.recursive && agent.recursive,
          },
        ];
      });
    if (!roots.length) throw new Error("Агенту не разрешено чтение ни одной директории");
    return roots;
  }

  private load() {
    if (this.addon) return this.addon;
    const file = join(this.nativeRoot, "zvs_tools.node");
    try {
      this.addon = createRequire(import.meta.url)(file) as NativeSearchAddon;
      return this.addon;
    } catch (error) {
      throw new Error(`Нативные инструменты поиска не собраны (${file}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
