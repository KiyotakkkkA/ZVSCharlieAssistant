import { makeAutoObservable, runInAction } from "mobx";
import type { Project } from "../../ipc/contracts";
import {
  parseIpcDto,
  upsertProjectDtoSchema,
  type UpsertProjectInput,
} from "../../shared/dto";

export function toProjectUpsertDto(
  input: UpsertProjectInput,
): UpsertProjectInput {
  return parseIpcDto(upsertProjectDtoSchema, input);
}

class ProjectStore {
  projects: Project[] = [];
  activeProjectId: string | null = null;
  loading = false;
  saving = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get active(): Project | undefined {
    return this.projects.find((item) => item.id === this.activeProjectId);
  }

  get available(): Project[] {
    return this.projects.filter((item) => !item.archived);
  }

  async load() {
    this.loading = true;
    try {
      const projects = await window.desktop.projects.list();
      runInAction(() => {
        this.projects = projects;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async save(input: UpsertProjectInput): Promise<Project> {
    this.saving = true;
    try {
      const project = await window.desktop.projects.upsert(
        toProjectUpsertDto(input),
      );
      await this.load();
      return project;
    } finally {
      runInAction(() => {
        this.saving = false;
      });
    }
  }

  async remove(id: string) {
    await window.desktop.projects.remove(id);
    if (this.activeProjectId === id)
      runInAction(() => {
        this.activeProjectId = null;
      });
    await this.load();
  }

  async loadForConversation(conversationId: string | null) {
    if (!conversationId) return;
    const projectId =
      await window.desktop.projects.conversationProject(conversationId);
    if (projectId === null && this.activeProjectId) {
      await window.desktop.projects.assignConversation(
        conversationId,
        this.activeProjectId,
      );
      return;
    }
    runInAction(() => {
      this.activeProjectId = projectId;
    });
  }

  async assign(conversationId: string | null, projectId: string | null) {
    runInAction(() => {
      this.activeProjectId = projectId;
    });
    if (!conversationId) return;
    await window.desktop.projects.assignConversation(conversationId, projectId);
  }
}

export const projectStore = new ProjectStore();
