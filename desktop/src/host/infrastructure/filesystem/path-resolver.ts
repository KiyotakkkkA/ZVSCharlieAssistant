import { isAbsolute, normalize, resolve, sep, dirname } from "node:path";
import { realpathSync } from "node:fs";
import type {
  AgentDirectoryPolicy,
  DirectoryGrant,
  DirectoryPermission,
} from "../../../shared/dto";
import type { DirectoryPolicyRepository } from "../database/directory-policy.repository";

export type FileOperation = "read" | "create" | "modify" | "delete";

export interface EffectiveDirectoryPolicies {
  agent: AgentDirectoryPolicy | undefined;
  project?: DirectoryGrant[];
}

const OPERATION_PERMISSION: Record<FileOperation, DirectoryPermission> = {
  read: "read",
  create: "create",
  modify: "modify",
  delete: "delete",
};

export class PathResolver {
  constructor(private readonly policies: DirectoryPolicyRepository) {}

  resolve(
    rawPath: string,
    operation: FileOperation,
    policies: EffectiveDirectoryPolicies,
  ): string {
    if (!policies.agent)
      throw new Error("Политика доступа агента к директориям не настроена");
    const candidate = rawPath.trim();
    if (!candidate) throw new Error("Путь не указан");
    if (!isAbsolute(candidate))
      throw new Error(
        `Требуется абсолютный путь, получено «${candidate}». Относительные пути неоднозначны для агента.`,
      );

    const target = realResolve(normalize(resolve(candidate)));
    const permission = OPERATION_PERMISSION[operation];
    const grants = this.effectiveGrants(policies, permission);
    if (!grants.length)
      throw new Error(
        `Агенту не разрешена операция «${permission}» ни в одной директории`,
      );

    const allowed = grants.some((grant) => contains(grant, target));
    if (!allowed)
      throw new Error(
        `Путь «${target}» вне разрешённых директорий. Разрешено: ${grants
          .map((grant) => grant.path)
          .join(", ")}`,
      );
    return target;
  }

  private effectiveGrants(
    policies: EffectiveDirectoryPolicies,
    permission: DirectoryPermission,
  ): DirectoryGrant[] {
    const agentGrants = new Map(
      (policies.agent?.grants ?? []).map((grant) => [key(grant.path), grant]),
    );
    const projectGrants = policies.project
      ? new Map(policies.project.map((grant) => [key(grant.path), grant]))
      : undefined;

    return this.policies.get().grants.flatMap((global) => {
      if (!global.permissions.includes(permission)) return [];
      const agent = agentGrants.get(key(global.path));
      if (!agent || !agent.permissions.includes(permission)) return [];
      let recursive = global.recursive && agent.recursive;
      if (projectGrants) {
        const project = projectGrants.get(key(global.path));
        if (!project || !project.permissions.includes(permission)) return [];
        recursive = recursive && project.recursive;
      }
      return [{ ...global, recursive }];
    });
  }
}

function realResolve(path: string): string {
  let current = path;
  const tail: string[] = [];
  for (;;) {
    try {
      const real = realpathSync.native(current);
      return tail.length ? resolve(real, ...tail.reverse()) : real;
    } catch {
      const parent = dirname(current);
      if (parent === current) return path;
      tail.push(current.slice(parent.length + 1));
      current = parent;
    }
  }
}

function key(path: string): string {
  return process.platform === "win32"
    ? normalize(path).toLowerCase()
    : normalize(path);
}

function contains(grant: DirectoryGrant, target: string): boolean {
  const root = key(grant.path).replace(/[\\/]+$/, "");
  const candidate = key(target);
  if (candidate === root) return true;
  const prefix = root + sep.toLowerCase();
  const normalizedCandidate =
    process.platform === "win32" ? candidate.replace(/\//g, "\\") : candidate;
  const normalizedPrefix =
    process.platform === "win32" ? prefix.replace(/\//g, "\\") : prefix;
  if (!normalizedCandidate.startsWith(normalizedPrefix)) return false;
  if (grant.recursive) return true;
  const rest = normalizedCandidate.slice(normalizedPrefix.length);
  return !rest.includes(sep);
}
