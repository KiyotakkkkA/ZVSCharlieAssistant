import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Project, ProjectRepositoryState } from "../../../shared/models/project";
import type { ProjectRepository } from "../../infrastructure/database/project.repository";

const INSTRUCTION_FILES = ["AGENTS.md", "ZVS.md", "CLAUDE.md"];
const INSTRUCTIONS_MAX_CHARS = 12_000;
const GIT_TIMEOUT_MS = 2_000;

interface CachedInstructions {
  mtimeMs: number;
  path: string;
  content: string;
}

export class ProjectContextService {
  private readonly instructionCache = new Map<string, CachedInstructions>();

  constructor(private readonly projects: ProjectRepository) {}

  forConversation(conversationId: string): Project | undefined {
    const projectId = this.projects.conversationProjectId(conversationId);
    if (!projectId) return undefined;
    const project = this.projects.find(projectId);
    return project?.archived ? undefined : project;
  }

  assignConversation(conversationId: string, projectId: string): void {
    const project = this.projects.find(projectId);
    if (!project || project.archived)
      throw new Error("Проект не найден или архивирован");
    this.projects.assignConversation(conversationId, projectId);
  }

  promptBlock(project: Project | undefined): string {
    if (!project) return "";
    const sections: string[] = [`Проект: ${project.name}`];
    if (project.rootPath) sections.push(`Корень проекта: ${project.rootPath}`);

    const repository = this.repositoryState(project);
    if (repository?.branch) {
      const dirty = repository.dirtyFiles
        ? `, изменённых файлов: ${repository.dirtyFiles}`
        : ", рабочее дерево чистое";
      const sync =
        repository.ahead || repository.behind
          ? `, впереди на ${repository.ahead}, позади на ${repository.behind}`
          : "";
      sections.push(`Git: ветка ${repository.branch}${dirty}${sync}`);
    }

    if (project.instructions.trim())
      sections.push(`Указания по проекту:\n${project.instructions.trim()}`);

    const file = this.instructionFile(project);
    if (file)
      sections.push(
        `Инструкции из ${file.path}:\n${file.content}`,
      );

    return `\n\n${sections.join("\n\n")}`;
  }

  instructionFile(project: Project): CachedInstructions | undefined {
    if (!project.rootPath || !existsSync(project.rootPath)) return undefined;
    for (const name of INSTRUCTION_FILES) {
      const path = join(project.rootPath, name);
      if (!existsSync(path)) continue;
      try {
        const stats = statSync(path);
        const cached = this.instructionCache.get(project.id);
        if (cached && cached.path === path && cached.mtimeMs === stats.mtimeMs)
          return cached;
        const content = readFileSync(path, "utf8").slice(
          0,
          INSTRUCTIONS_MAX_CHARS,
        );
        const entry = { mtimeMs: stats.mtimeMs, path: name, content };
        this.instructionCache.set(project.id, entry);
        return entry;
      } catch {
        return undefined;
      }
    }
    this.instructionCache.delete(project.id);
    return undefined;
  }

  repositoryState(project: Project): ProjectRepositoryState | undefined {
    if (!project.rootPath || !existsSync(join(project.rootPath, ".git")))
      return undefined;
    try {
      const output = execFileSync(
        "git",
        ["status", "--porcelain=v1", "--branch"],
        {
          cwd: project.rootPath,
          encoding: "utf8",
          timeout: GIT_TIMEOUT_MS,
          windowsHide: true,
        },
      );
      return parseGitStatus(output);
    } catch {
      return undefined;
    }
  }
}

function parseGitStatus(output: string): ProjectRepositoryState {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const header = lines[0] ?? "";
  const state: ProjectRepositoryState = {
    branch: null,
    dirtyFiles: 0,
    ahead: 0,
    behind: 0,
  };
  if (header.startsWith("##")) {
    const branch = /^## ([^.\s]+)/.exec(header);
    state.branch = branch?.[1] ?? null;
    const ahead = /ahead (\d+)/.exec(header);
    const behind = /behind (\d+)/.exec(header);
    state.ahead = ahead ? Number(ahead[1]) : 0;
    state.behind = behind ? Number(behind[1]) : 0;
    state.dirtyFiles = lines.length - 1;
  } else {
    state.dirtyFiles = lines.length;
  }
  return state;
}
