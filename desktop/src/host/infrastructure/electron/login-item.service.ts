import type { App } from "electron";

export const BACKGROUND_LAUNCH_ARGUMENT = "--background";

type LoginItemApp = Pick<
  App,
  "getAppPath" | "getLoginItemSettings" | "isPackaged" | "setLoginItemSettings"
>;

export class LoginItemService {
  constructor(
    private readonly electronApp: LoginItemApp,
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly executablePath: string = process.execPath,
  ) {}

  setEnabled(enabled: boolean): void {
    if (!this.isSupported()) return;

    this.electronApp.setLoginItemSettings(
      this.platform === "win32"
        ? {
            openAtLogin: enabled,
            path: this.executablePath,
            args: this.electronApp.isPackaged
              ? [BACKGROUND_LAUNCH_ARGUMENT]
              : [this.electronApp.getAppPath(), BACKGROUND_LAUNCH_ARGUMENT],
          }
        : { openAtLogin: enabled },
    );
  }

  wasLaunchedInBackground(argv: readonly string[]): boolean {
    if (argv.includes(BACKGROUND_LAUNCH_ARGUMENT)) return true;
    return (
      this.platform === "darwin" &&
      this.electronApp.getLoginItemSettings().wasOpenedAtLogin
    );
  }

  private isSupported(): boolean {
    return this.platform === "win32" || this.platform === "darwin";
  }
}
