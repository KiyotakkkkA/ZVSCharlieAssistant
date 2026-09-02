import { ipcMain } from "electron";
import { ZVS_ID_IPC_CHANNELS } from "../contracts";
import type { ZvsIdService } from "../../host/application/services/zvs-id.service";

export function registerZvsIdHandlers(service: ZvsIdService): void {
  ipcMain.handle(ZVS_ID_IPC_CHANNELS.status, () => service.status());
  ipcMain.handle(ZVS_ID_IPC_CHANNELS.connect, () => service.connect());
  ipcMain.handle(ZVS_ID_IPC_CHANNELS.cancelConnect, () =>
    service.cancelConnect(),
  );
  ipcMain.handle(ZVS_ID_IPC_CHANNELS.disconnect, () => service.disconnect());
}

export function removeZvsIdHandlers(): void {
  ipcMain.removeHandler(ZVS_ID_IPC_CHANNELS.status);
  ipcMain.removeHandler(ZVS_ID_IPC_CHANNELS.connect);
  ipcMain.removeHandler(ZVS_ID_IPC_CHANNELS.cancelConnect);
  ipcMain.removeHandler(ZVS_ID_IPC_CHANNELS.disconnect);
}
