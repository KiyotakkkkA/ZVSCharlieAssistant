import { app, ipcMain } from "electron";
import { IPC_CHANNELS, type AppInfo } from "../contracts";
import type { GeneratedArtifactExporter } from "../../host/application/ports/generated-artifact.port";

export function registerAppHandlers(
  artifacts: GeneratedArtifactExporter,
): void {
  ipcMain.handle(IPC_CHANNELS.getAppInfo, (): AppInfo => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform,
  }));
  ipcMain.handle(IPC_CHANNELS.saveGeneratedArtifact, (_event, input) =>
    artifacts.save(input),
  );
}

export function removeAppHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.getAppInfo);
  ipcMain.removeHandler(IPC_CHANNELS.saveGeneratedArtifact);
}
