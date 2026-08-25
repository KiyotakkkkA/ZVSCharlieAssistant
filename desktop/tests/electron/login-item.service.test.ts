import type { App } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  BACKGROUND_LAUNCH_ARGUMENT,
  LoginItemService,
} from "../../src/host/infrastructure/electron/login-item.service";

describe("LoginItemService", () => {
  it("registers the Windows executable with the hidden-start argument", () => {
    const setLoginItemSettings = vi.fn();
    const service = new LoginItemService(
      createApp(setLoginItemSettings),
      "win32",
      "C:\\Program Files\\ZVS\\ZVS Assistant.exe",
    );

    service.setEnabled(true);

    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      path: "C:\\Program Files\\ZVS\\ZVS Assistant.exe",
      args: [BACKGROUND_LAUNCH_ARGUMENT],
    });
  });

  it("uses the same Windows identity when disabling the login item", () => {
    const setLoginItemSettings = vi.fn();
    const service = new LoginItemService(
      createApp(setLoginItemSettings),
      "win32",
      "C:\\ZVS.exe",
    );

    service.setEnabled(false);

    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: false,
      path: "C:\\ZVS.exe",
      args: [BACKGROUND_LAUNCH_ARGUMENT],
    });
  });

  it("includes the application path when Electron runs unpackaged", () => {
    const setLoginItemSettings = vi.fn();
    const service = new LoginItemService(
      createApp(setLoginItemSettings, false, false),
      "win32",
      "C:\\Electron\\electron.exe",
    );

    service.setEnabled(true);

    expect(setLoginItemSettings).toHaveBeenCalledWith({
      openAtLogin: true,
      path: "C:\\Electron\\electron.exe",
      args: ["C:\\ZVS", BACKGROUND_LAUNCH_ARGUMENT],
    });
  });

  it("recognizes explicit and macOS login launches", () => {
    const explicit = new LoginItemService(createApp(vi.fn()), "win32");
    expect(
      explicit.wasLaunchedInBackground(["ZVS.exe", BACKGROUND_LAUNCH_ARGUMENT]),
    ).toBe(true);

    const mac = new LoginItemService(createApp(vi.fn(), true), "darwin");
    expect(mac.wasLaunchedInBackground(["ZVS Assistant"])).toBe(true);
  });

  it("does not call unsupported platform APIs", () => {
    const setLoginItemSettings = vi.fn();
    const service = new LoginItemService(
      createApp(setLoginItemSettings),
      "linux",
    );

    service.setEnabled(true);

    expect(setLoginItemSettings).not.toHaveBeenCalled();
  });
});

function createApp(
  setLoginItemSettings: ReturnType<typeof vi.fn>,
  wasOpenedAtLogin = false,
  isPackaged = true,
): Pick<
  App,
  | "getAppPath"
  | "getLoginItemSettings"
  | "isPackaged"
  | "setLoginItemSettings"
> {
  return {
    isPackaged,
    getAppPath: vi.fn(() => "C:\\ZVS"),
    setLoginItemSettings,
    getLoginItemSettings: vi.fn(() => ({ wasOpenedAtLogin })) as never,
  };
}
