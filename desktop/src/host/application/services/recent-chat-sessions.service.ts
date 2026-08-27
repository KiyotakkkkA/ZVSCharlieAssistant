import type { RecentChatSession } from "../../../shared/models/chat";
import type { ChatRepository } from "../../infrastructure/database/chat.repository";
import type { ProjectRepository } from "../../infrastructure/database/project.repository";

export class RecentChatSessionsService {
  constructor(
    private readonly chats: ChatRepository,
    private readonly projects: ProjectRepository,
  ) {}

  list(limit = 5): RecentChatSession[] {
    const safeLimit = Math.min(5, Math.max(0, Math.trunc(limit)));
    return this.chats.conversations(safeLimit).map((conversation) => {
      const projectId = this.projects.conversationProjectId(conversation.id);
      const project = projectId ? this.projects.find(projectId) : undefined;
      return {
        conversationId: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        usage: conversation.lastUsage,
        project: project
          ? {
              id: project.id,
              name: project.name,
              rootPath: project.rootPath,
            }
          : null,
      };
    });
  }
}
