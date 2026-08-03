import { BrowserWindow } from "electron";
import { join } from "node:path";

export function createMainWindow(): BrowserWindow {
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
    },
  });

  window.maximize();

  window.once("ready-to-show", () => window.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}
