import { BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { isSafeExternalUrl } from "./core-interactor.service";

function restrictNavigation(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const current = window.webContents.getURL();
    if (url.split("#")[0] === current.split("#")[0]) return;
    event.preventDefault();
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
  });

  window.webContents.on("will-attach-webview", (event) =>
    event.preventDefault(),
  );
}

interface CreateMainWindowOptions {
  showOnReady?: boolean;
}

export function createMainWindow({
  showOnReady = true,
}: CreateMainWindowOptions = {}): BrowserWindow {
  const window = new BrowserWindow({
    minWidth: 760,
    minHeight: 520,
    show: false,
    backgroundColor: "#0b1020",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
    },
  });

  restrictNavigation(window);

  window.maximize();

  if (showOnReady) window.once("ready-to-show", () => window.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}
