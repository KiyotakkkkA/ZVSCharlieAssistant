import type { UpsertProjectInput } from "../../../shared/dto";
import type { Project } from "../../../shared/models/project";
import type { DirectoryPolicyRepository } from "../../infrastructure/database/directory-policy.repository";
import type { ProjectRepository } from "../../infrastructure/database/project.repository";

const PROJECT_PERMISSIONS = ["read", "create", "modify"] as const;

export class ProjectManagementService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly directoryPolicy: DirectoryPolicyRepository,
  ) {}

  list(): Project[] {
    return this.projects.list();
  }

  upsert(input: UpsertProjectInput): Project {
    return this.ensureGlobalDirectoryPolicy(this.projects.upsert(input));
  }

  ensureForDirectory(directoryPath: string): Project {
    return this.ensureGlobalDirectoryPolicy(
      this.projects.ensureForDirectory(directoryPath),
    );
  }

  remove(id: string): void {
    this.projects.remove(id);
  }

  assignConversation(conversationId: string, projectId: string | null): void {
    this.projects.assignConversation(conversationId, projectId);
  }

  conversationProjectId(conversationId: string): string | null {
    return this.projects.conversationProjectId(conversationId);
  }

  private ensureGlobalDirectoryPolicy(project: Project): Project {
    if (!project.rootPath) return project;
    this.directoryPolicy.ensureGrant({
      path: project.rootPath,
      recursive: true,
      permissions: [...PROJECT_PERMISSIONS],
    });
    return project;
  }
}
