import { ipcMain } from "electron";
import type { ChatDataSource } from "../../host/infrastructure/database/chat.data-source";
import type { RunEngine } from "../../host/infrastructure/text-generation/run-engine";
import { CHAT_IPC_CHANNELS, type StartRunInput } from "../contracts";
export function registerChatHandlers(data: ChatDataSource, engine: RunEngine) {
  ipcMain.handle(CHAT_IPC_CHANNELS.getSnapshot, (_event, id?: number) =>
    data.snapshot(id),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.getMessagesPage,
    (_event, id: number, beforeId?: number) => data.messagePage(id, beforeId),
  );
  ipcMain.handle(CHAT_IPC_CHANNELS.startRun, (event, input: StartRunInput) =>
    engine.start(input, (payload) => {
      if (!event.sender.isDestroyed())
        event.sender.send(CHAT_IPC_CHANNELS.event, payload);
    }),
  );
  ipcMain.handle(CHAT_IPC_CHANNELS.cancelRun, (_event, id: number) =>
    engine.cancel(id),
  );
  ipcMain.handle(CHAT_IPC_CHANNELS.deleteConversation, (_event, id: number) =>
    data.deleteConversation(id),
  );
  ipcMain.handle(
    CHAT_IPC_CHANNELS.renameConversation,
    (_event, id: number, title: string) => data.renameConversation(id, title),
  );
}
export function removeChatHandlers() {
  for (const channel of Object.values(CHAT_IPC_CHANNELS))
    if (channel !== CHAT_IPC_CHANNELS.event) ipcMain.removeHandler(channel);
}
