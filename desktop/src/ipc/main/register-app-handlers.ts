import { app, dialog, ipcMain } from "electron";
import { IPC_CHANNELS, type AppInfo } from "../contracts";
import type { GeneratedArtifactExporter } from "../../host/application/ports/generated-artifact.ports";

export function registerAppHandlers(
  artifacts: GeneratedArtifactExporter,
): void {
  ipcMain.handle(
    IPC_CHANNELS.getAppInfo,
    (): AppInfo => ({
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
    }),
  );
  ipcMain.handle(IPC_CHANNELS.saveGeneratedArtifact, (_event, input) =>
    artifacts.save(input),
  );
  ipcMain.handle(IPC_CHANNELS.selectDirectory, async () => {
    const result = await dialog.showOpenDialog({
      title: "Выберите разрешённую директорию",
      properties: ["openDirectory", "createDirectory"],
    });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });
}

export function removeAppHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.getAppInfo);
  ipcMain.removeHandler(IPC_CHANNELS.saveGeneratedArtifact);
  ipcMain.removeHandler(IPC_CHANNELS.selectDirectory);
}
