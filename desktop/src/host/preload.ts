import { contextBridge } from "electron";
import { desktopApi } from "../ipc/preload/desktop-api";

contextBridge.exposeInMainWorld("desktop", desktopApi);
