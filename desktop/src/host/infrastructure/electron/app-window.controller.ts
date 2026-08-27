import type { BrowserWindow } from "electron";
import { IPC_CHANNELS, type AppCommand } from "../../../ipc/contracts";
import { createMainWindow } from "./create-main-window";

export class AppWindowController {
  private window: BrowserWindow | undefined;
  private closeToTray = false;
  private quitting = false;

  create(options: { showOnReady?: boolean } = {}): BrowserWindow {
    const current = this.window;
    if (current && !current.isDestroyed()) return current;

    const window = createMainWindow(options);
    this.window = window;

    window.on("close", (event) => {
      if (this.quitting || !this.closeToTray) return;
      event.preventDefault();
      window.hide();
    });
    window.on("closed", () => {
      if (this.window === window) this.window = undefined;
    });

    return window;
  }

  show(): void {
    const window = this.create();
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  }

  dispatchCommand(command: AppCommand): void {
    const window = this.create();
    this.show();

    const dispatch = () =>
      window.webContents.send(IPC_CHANNELS.command, command);
    if (window.webContents.isLoading()) {
      window.webContents.once("did-finish-load", dispatch);
      return;
    }
    dispatch();
  }

  send(channel: string, payload: unknown): void {
    const window = this.window;
    if (!window || window.isDestroyed() || window.webContents.isDestroyed())
      return;

    const dispatch = () => window.webContents.send(channel, payload);
    if (window.webContents.isLoading()) {
      window.webContents.once("did-finish-load", dispatch);
      return;
    }
    dispatch();
  }

  setCloseToTray(enabled: boolean): void {
    this.closeToTray = enabled;
  }

  keepsRunningInBackground(): boolean {
    return this.closeToTray;
  }

  beginQuit(): void {
    this.quitting = true;
  }
}
