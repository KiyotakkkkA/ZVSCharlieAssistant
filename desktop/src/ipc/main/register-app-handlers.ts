import { statSync } from "node:fs";
import { dirname } from "node:path";
import { app, clipboard, dialog, ipcMain, shell } from "electron";
import {
  IPC_CHANNELS,
  type AppLocation,
  type AppInfo,
  type ApplicationSettings,
  type UpdateApplicationSettingsInput,
} from "../contracts";
import type { GeneratedArtifactExporter } from "../../host/application/ports/generated-artifact.ports";
import {
  parseIpcDto,
  updateApplicationSettingsDtoSchema,
} from "../../shared/dto";

interface ApplicationSettingsHandler {
  get(): ApplicationSettings;
  update(input: UpdateApplicationSettingsInput): ApplicationSettings;
}

export function registerAppHandlers(
  artifacts: GeneratedArtifactExporter,
  settings: ApplicationSettingsHandler,
): void {
  ipcMain.handle(IPC_CHANNELS.getAppInfo, (): AppInfo => {
    const executablePath = app.getPath("exe");
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      updatedAt: statSync(executablePath).mtime.toISOString(),
      installPath: dirname(executablePath),
      userDataPath: app.getPath("userData"),
    };
  });
  ipcMain.handle(
    IPC_CHANNELS.openAppLocation,
    async (_event, location: AppLocation) => {
      const target =
        location === "install"
          ? dirname(app.getPath("exe"))
          : location === "userData"
            ? app.getPath("userData")
            : null;
      if (!target) throw new Error("Неизвестное расположение приложения");
      const error = await shell.openPath(target);
      if (error) throw new Error(error);
    },
  );
  ipcMain.handle(IPC_CHANNELS.writeClipboardText, (_event, text: unknown) => {
    if (typeof text !== "string")
      throw new Error("Текст для буфера обмена должен быть строкой");
    if (Buffer.byteLength(text, "utf8") > 5 * 1_048_576)
      throw new Error("Текст для буфера обмена превышает 5 МБ");
    clipboard.writeText(text);
  });
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
  ipcMain.handle(IPC_CHANNELS.getApplicationSettings, () => settings.get());
  ipcMain.handle(
    IPC_CHANNELS.updateApplicationSettings,
    (_event, input: UpdateApplicationSettingsInput) =>
      settings.update(parseIpcDto(updateApplicationSettingsDtoSchema, input)),
  );
}

export function removeAppHandlers(): void {
  ipcMain.removeHandler(IPC_CHANNELS.getAppInfo);
  ipcMain.removeHandler(IPC_CHANNELS.openAppLocation);
  ipcMain.removeHandler(IPC_CHANNELS.writeClipboardText);
  ipcMain.removeHandler(IPC_CHANNELS.saveGeneratedArtifact);
  ipcMain.removeHandler(IPC_CHANNELS.selectDirectory);
  ipcMain.removeHandler(IPC_CHANNELS.getApplicationSettings);
  ipcMain.removeHandler(IPC_CHANNELS.updateApplicationSettings);
}
