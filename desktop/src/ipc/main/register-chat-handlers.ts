import { ipcMain } from "electron";
import type { ChatRepository } from "../../host/infrastructure/database/chat.repository";
import type { RunEngine } from "../../host/infrastructure/text-generation/run-engine";
import type { FileEditRepository } from "../../host/infrastructure/database/file-edit.repository";
import type { FileSystemService } from "../../host/infrastructure/filesystem/file-system.service";
import { CHAT_IPC_CHANNELS } from "../contracts";
import {
  entityIdSchema,
  entityTitleSchema,
  parseIpcDto,
  startRunDtoSchema,
  type StartRunInput,
} from "../../shared/dto";
export function registerChatHandlers(
  data: ChatRepository,
  engine: RunEngine,
  fileEdits: FileEditRepository,
  files: FileSystemService,
) {
  ipcMain.handle(CHAT_IPC_CHANNELS.getSnapshot, (_event, id?: string) =>
    data.snapshot(parseIpcDto(entityIdSchema.optional(), id)),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.getMessagesPage,
    (_event, id: string, beforeId?: string) =>
      data.messagePage(
        parseIpcDto(entityIdSchema, id),
        parseIpcDto(entityIdSchema.optional(), beforeId),
      ),
  );
  ipcMain.handle(CHAT_IPC_CHANNELS.startRun, (event, input: StartRunInput) =>
    engine.start(parseIpcDto(startRunDtoSchema, input), (payload) => {
      if (!event.sender.isDestroyed())
        event.sender.send(CHAT_IPC_CHANNELS.event, payload);
    }),
  );
  ipcMain.handle(CHAT_IPC_CHANNELS.cancelRun, (_event, id: string) =>
    engine.cancel(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(CHAT_IPC_CHANNELS.deleteConversation, (_event, id: string) =>
    data.deleteConversation(parseIpcDto(entityIdSchema, id)),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.renameConversation,
    (_event, id: string, title: string) =>
      data.renameConversation(
        parseIpcDto(entityIdSchema, id),
        parseIpcDto(entityTitleSchema, title),
      ),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.truncateMessages,
    (_event, conversationId: string, fromMessageId: string) =>
      data.truncateMessages(
        parseIpcDto(entityIdSchema, conversationId),
        parseIpcDto(entityIdSchema, fromMessageId),
      ),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.compactConversation,
    (event, conversationId: string, modelId: string, focus?: string) =>
      engine.compactConversation(
        parseIpcDto(entityIdSchema, conversationId),
        parseIpcDto(entityIdSchema, modelId),
        focus,
        (payload) => {
          if (!event.sender.isDestroyed())
            event.sender.send(CHAT_IPC_CHANNELS.event, payload);
        },
      ),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.contextWindow,
    (_event, conversationId: string, modelId: string) =>
      engine.contextWindow(
        parseIpcDto(entityIdSchema, conversationId),
        parseIpcDto(entityIdSchema, modelId),
      ),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.listFileEdits,
    (_event, conversationId: string) =>
      fileEdits.listByConversation(parseIpcDto(entityIdSchema, conversationId)),
  );
  ipcMain.handle(CHAT_IPC_CHANNELS.revertRun, (_event, runId: string) =>
    files.revertRun(parseIpcDto(entityIdSchema, runId)),
  );
}
export function removeChatHandlers() {
  for (const channel of Object.values(CHAT_IPC_CHANNELS))
    if (channel !== CHAT_IPC_CHANNELS.event) ipcMain.removeHandler(channel);
}
