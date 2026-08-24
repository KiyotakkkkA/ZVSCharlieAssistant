import { ipcMain } from "electron";
import type { CliInstallerService } from "../../host/infrastructure/extensions/cli-installer.service";
import { EXTENSION_IPC_CHANNELS } from "../contracts";

export function registerExtensionHandlers(cli: CliInstallerService) {
  ipcMain.handle(EXTENSION_IPC_CHANNELS.cliStatus, () => cli.status());
  ipcMain.handle(EXTENSION_IPC_CHANNELS.installCli, () => cli.install());
  ipcMain.handle(EXTENSION_IPC_CHANNELS.uninstallCli, () => cli.uninstall());
}

export function removeExtensionHandlers() {
  for (const channel of Object.values(EXTENSION_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
