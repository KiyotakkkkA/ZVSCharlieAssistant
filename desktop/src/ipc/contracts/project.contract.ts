import type { Project } from "../../shared/models/project";
import type { UpsertProjectInput } from "../../shared/dto";

export type * from "../../shared/models/project";

export interface ProjectApi {
  list(): Promise<Project[]>;
  upsert(input: UpsertProjectInput): Promise<Project>;
  remove(id: string): Promise<void>;
  assignConversation(
    conversationId: string,
    projectId: string | null,
  ): Promise<void>;
  conversationProject(conversationId: string): Promise<string | null>;
}

export const PROJECT_IPC_CHANNELS = {
  list: "project:list",
  upsert: "project:upsert",
  remove: "project:remove",
  assignConversation: "project:assign-conversation",
  conversationProject: "project:conversation-project",
} as const;
