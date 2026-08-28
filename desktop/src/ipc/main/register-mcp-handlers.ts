import { BrowserWindow, ipcMain, shell } from "electron";
import type { McpService } from "../../host/infrastructure/mcp/mcp.service";
import { MCP_IPC_CHANNELS } from "../contracts/mcp.contract";

const broadcast = (channel: string, payload: unknown) => {
  for (const window of BrowserWindow.getAllWindows())
    if (!window.webContents.isDestroyed())
      window.webContents.send(channel, payload);
};

export function registerMcpHandlers(service: McpService) {
  service.watch((snapshot) =>
    broadcast(MCP_IPC_CHANNELS.snapshotChanged, snapshot),
  );

  ipcMain.handle(MCP_IPC_CHANNELS.getSnapshot, () => service.snapshot());
  ipcMain.handle(MCP_IPC_CHANNELS.revalidate, () => service.revalidate());
  ipcMain.handle(MCP_IPC_CHANNELS.openConfigFolder, () => {
    shell.showItemInFolder(service.configPath);
  });
}

export function removeMcpHandlers() {
  for (const channel of Object.values(MCP_IPC_CHANNELS))
    if (channel !== MCP_IPC_CHANNELS.snapshotChanged)
      ipcMain.removeHandler(channel);
}
