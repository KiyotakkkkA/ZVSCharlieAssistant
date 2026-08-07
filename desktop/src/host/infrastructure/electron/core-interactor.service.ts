import { shell } from "electron";
import { CoreInteractor } from "@host/application/ports/core-interactor.ports";

export class CoreInteractorService implements CoreInteractor {
  async openExternalUrl(url: string): Promise<boolean> {
    await shell.openExternal(url);
    return true;
  }
}
