import { CoreInteractorApi } from "@ipc/contracts";
import { ipcMain } from "electron";

export function registerCoreInteractorHandlers(
  coreInteractor: CoreInteractorApi,
) {
  ipcMain.handle("coreInteractor:openExternalUrl", (_event, url: string) =>
    coreInteractor.openExternalUrl(url),
  );
}

export function removeCoreInteractorHandlers() {
  ipcMain.removeHandler("coreInteractor:openExternalUrl");
}
