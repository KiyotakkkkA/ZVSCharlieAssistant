import { ipcMain } from "electron";
import type { DownloadManagerService } from "../../host/infrastructure/downloads/download-manager.service";
import { DOWNLOADS_IPC_CHANNELS } from "../contracts";
import { isDownloadId, type DownloadId } from "../../shared/models/downloads";

function parseId(value: unknown): DownloadId {
  if (!isDownloadId(value)) throw new Error("Неизвестная загрузка");
  return value;
}

export function registerDownloadsHandlers(manager: DownloadManagerService) {
  ipcMain.handle(DOWNLOADS_IPC_CHANNELS.getSnapshot, () => manager.snapshot());
  ipcMain.handle(DOWNLOADS_IPC_CHANNELS.start, (_event, id: unknown) =>
    manager.start(parseId(id)),
  );
  ipcMain.handle(DOWNLOADS_IPC_CHANNELS.cancel, (_event, id: unknown) =>
    manager.cancel(parseId(id)),
  );
  ipcMain.handle(DOWNLOADS_IPC_CHANNELS.remove, (_event, id: unknown) =>
    manager.remove(parseId(id)),
  );
  ipcMain.handle(DOWNLOADS_IPC_CHANNELS.reveal, (_event, id: unknown) => {
    manager.reveal(parseId(id));
  });
}

export function removeDownloadsHandlers() {
  for (const channel of Object.values(DOWNLOADS_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
