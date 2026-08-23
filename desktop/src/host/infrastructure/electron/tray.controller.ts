import { app, Menu, Tray, nativeImage, type NativeImage } from "electron";
import { join } from "node:path";

interface TrayControllerOptions {
  onOpen(): void;
  onNewChat(): void;
  onOpenTasks(): void;
  onOpenScenarios(): void;
  onOpenSettings(): void;
  onStartOnboarding(): void;
  isBackgroundEnabled(): boolean;
  onBackgroundChange(enabled: boolean): void;
  onQuit(): void;
}

const APP_ICON_FILE = "app_icon.ico";

export class TrayController {
  private tray: Tray | undefined;

  constructor(private readonly options: TrayControllerOptions) {}

  create(): void {
    if (this.tray && !this.tray.isDestroyed()) return;

    const icon = loadTrayIcon();

    const tray = new Tray(icon);
    tray.setToolTip("ZVS Assistant");
    tray.on("click", this.options.onOpen);
    this.tray = tray;
    this.refresh();
  }

  refresh(): void {
    const tray = this.tray;
    if (!tray || tray.isDestroyed()) return;

    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Открыть ZVS Assistant",
          click: this.options.onOpen,
        },
        { type: "separator" },
        {
          label: "Новый диалог",
          click: this.options.onNewChat,
        },
        {
          label: "Задачи",
          click: this.options.onOpenTasks,
        },
        {
          label: "Сценарии",
          click: this.options.onOpenScenarios,
        },
        { type: "separator" },
        {
          label: "Работать в фоне",
          type: "checkbox",
          checked: this.options.isBackgroundEnabled(),
          click: (menuItem) => {
            this.options.onBackgroundChange(menuItem.checked);
            this.refresh();
          },
        },
        {
          label: "Настройки…",
          click: this.options.onOpenSettings,
        },
        {
          label: "Мастер настройки…",
          click: this.options.onStartOnboarding,
        },
        { type: "separator" },
        {
          label: "Выйти",
          click: this.options.onQuit,
        },
      ]),
    );
  }

  destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) this.tray.destroy();
    this.tray = undefined;
  }
}

function loadTrayIcon(): NativeImage {
  const developmentPath = join(app.getAppPath(), "assets", APP_ICON_FILE);
  const packagedPath = join(process.resourcesPath, "assets", APP_ICON_FILE);
  const candidates = app.isPackaged
    ? [packagedPath, developmentPath]
    : [developmentPath, packagedPath];

  for (const path of candidates) {
    const icon = nativeImage.createFromPath(path);
    if (!icon.isEmpty()) return icon;
  }

  throw new Error(
    `Failed to load the Tray icon from: ${candidates.join(", ")}`,
  );
}
