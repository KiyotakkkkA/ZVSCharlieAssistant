import { app, ipcMain } from "electron";
import { IPC_CHANNELS, type AppInfo } from "../contracts";

export function registerAppHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getAppInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
  }));
}

export function removeAppHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.getAppInfo);
}
