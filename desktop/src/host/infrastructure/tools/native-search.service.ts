import { createRequire } from "node:module";
import { join } from "node:path";
import type { AgentDirectoryPolicy, DirectoryGrant } from "../../../shared/dto";
import type { DirectoryPolicyRepository } from "../database/directory-policy.repository";

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
  entitySearch(
    input: EntitySearchInput & { allowedRoots: AllowedRoot[] },
  ): Promise<unknown>;
  regexpSearch(
    input: RegexpSearchInput & { allowedRoots: AllowedRoot[] },
  ): Promise<unknown>;
}

interface AllowedRoot {
  path: string;
  recursive: boolean;
}

export class NativeSearchService {
  private addon?: NativeSearchAddon;

  constructor(
    private readonly nativeRoot: string,
    private readonly policies: DirectoryPolicyRepository,
  ) {}

  entitySearch(
    input: EntitySearchInput,
    policy: AgentDirectoryPolicy,
    projectGrants?: DirectoryGrant[],
  ) {
    return this.load().entitySearch({
      ...input,
      allowedRoots: this.readRoots(policy, projectGrants),
    });
  }

  regexpSearch(
    input: RegexpSearchInput,
    policy: AgentDirectoryPolicy,
    projectGrants?: DirectoryGrant[],
  ) {
    return this.load().regexpSearch({
      ...input,
      allowedRoots: this.readRoots(policy, projectGrants),
    });
  }

  private readRoots(
    policy: AgentDirectoryPolicy,
    projectGrants?: DirectoryGrant[],
  ) {
    const requested = new Map(
      policy.grants.map((grant) => [grant.path.toLowerCase(), grant]),
    );
    const project = projectGrants
      ? new Map(projectGrants.map((grant) => [grant.path.toLowerCase(), grant]))
      : undefined;
    const roots = this.policies.get().grants.flatMap((global) => {
      const agent = requested.get(global.path.toLowerCase());
      if (
        !agent ||
        !global.permissions.includes("read") ||
        !agent.permissions.includes("read")
      )
        return [];
      let recursive = global.recursive && agent.recursive;
      if (project) {
        const scoped = project.get(global.path.toLowerCase());
        if (!scoped || !scoped.permissions.includes("read")) return [];
        recursive = recursive && scoped.recursive;
      }
      return [{ path: global.path, recursive }];
    });
    if (!roots.length)
      throw new Error(
        "Агенту не разрешено чтение ни одной директории в рамках проекта",
      );
    return roots;
  }

  private load() {
    if (this.addon) return this.addon;
    const file = join(this.nativeRoot, "zvs_tools.node");
    try {
      this.addon = createRequire(import.meta.url)(file) as NativeSearchAddon;
      return this.addon;
    } catch (error) {
      console.error("Не удалось загрузить нативный аддон поиска", file, error);
      throw new Error(
        "Инструменты поиска по файлам недоступны: нативный модуль не собран. Выполните «npm run build:native» в каталоге desktop.",
      );
    }
  }
}
