import { CORE_INTERACTOR_IPC_CHANNELS, CoreInteractorApi } from "@ipc/contracts";
import { ipcMain } from "electron";

export function registerCoreInteractorHandlers(
  coreInteractor: CoreInteractorApi,
) {
  ipcMain.handle(
    CORE_INTERACTOR_IPC_CHANNELS.openExternalUrl,
    (_event, url: string) => coreInteractor.openExternalUrl(url),
  );
}

export function removeCoreInteractorHandlers() {
  ipcMain.removeHandler(CORE_INTERACTOR_IPC_CHANNELS.openExternalUrl);
}
