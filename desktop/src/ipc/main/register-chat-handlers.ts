import { ipcMain } from "electron";
import type { ChatRepository } from "../../host/infrastructure/database/chat.repository";
import type { RunEngine } from "../../host/infrastructure/text-generation/run-engine";
import { CHAT_IPC_CHANNELS } from "../contracts";
import {
  entityIdSchema,
  entityTitleSchema,
  parseIpcDto,
  startRunDtoSchema,
  type StartRunInput,
} from "../../shared/dto";
export function registerChatHandlers(data: ChatRepository, engine: RunEngine) {
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
}
export function removeChatHandlers() {
  for (const channel of Object.values(CHAT_IPC_CHANNELS))
    if (channel !== CHAT_IPC_CHANNELS.event) ipcMain.removeHandler(channel);
}
