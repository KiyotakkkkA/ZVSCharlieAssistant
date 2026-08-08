import { ipcMain } from "electron";
import type { TaskHistoryRepository } from "../../host/infrastructure/database/task-history.repository";
import { TASKS_IPC_CHANNELS } from "../contracts";

export function registerTaskHandlers(dataSource: TaskHistoryRepository): void {
  ipcMain.handle(TASKS_IPC_CHANNELS.listAgentRuns, () =>
    dataSource.listAgentRuns(),
  );
}

export function removeTaskHandlers(): void {
  ipcMain.removeHandler(TASKS_IPC_CHANNELS.listAgentRuns);
}
