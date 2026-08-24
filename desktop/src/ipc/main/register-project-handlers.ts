import { ipcMain } from "electron";
import type { ProjectRepository } from "../../host/infrastructure/database/project.repository";
import { PROJECT_IPC_CHANNELS } from "../contracts";
import {
  assignConversationProjectDtoSchema,
  entityIdSchema,
  parseIpcDto,
  upsertProjectDtoSchema,
  type UpsertProjectInput,
} from "../../shared/dto";

export function registerProjectHandlers(projects: ProjectRepository) {
  ipcMain.handle(PROJECT_IPC_CHANNELS.list, () => projects.list());
  ipcMain.handle(
    PROJECT_IPC_CHANNELS.upsert,
    (_event, input: UpsertProjectInput) =>
      projects.upsert(parseIpcDto(upsertProjectDtoSchema, input)),
  );
  ipcMain.handle(PROJECT_IPC_CHANNELS.remove, (_event, id: string) =>
    projects.remove(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    PROJECT_IPC_CHANNELS.assignConversation,
    (_event, conversationId: string, projectId: string | null) => {
      const input = parseIpcDto(assignConversationProjectDtoSchema, {
        conversationId,
        projectId,
      });
      projects.assignConversation(input.conversationId, input.projectId);
    },
  );
  ipcMain.handle(
    PROJECT_IPC_CHANNELS.conversationProject,
    (_event, conversationId: string) =>
      projects.conversationProjectId(parseIpcDto(entityIdSchema, conversationId)),
  );
}

export function removeProjectHandlers() {
  for (const channel of Object.values(PROJECT_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
