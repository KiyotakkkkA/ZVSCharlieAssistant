import { shell } from "electron";
import { CoreInteractor } from "@host/application/ports/core-interactor.ports";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeExternalUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length > 4096) return false;
  try {
    return ALLOWED_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export class CoreInteractorService implements CoreInteractor {
  async openExternalUrl(url: string): Promise<boolean> {
    if (!isSafeExternalUrl(url))
      throw new Error("Разрешены только ссылки http, https и mailto");
    await shell.openExternal(url);
    return true;
  }
}
