import type { DesktopApi } from "../../ipc/contracts";

declare global {
  interface Window {
    desktop: DesktopApi;
  }
}

export {};
