import { ipcMain } from "electron";
import type { TaskHistoryDataSource } from "../../host/infrastructure/database/task-history.data-source";
import { TASKS_IPC_CHANNELS } from "../contracts";

export function registerTaskHandlers(dataSource: TaskHistoryDataSource): void {
  ipcMain.handle(TASKS_IPC_CHANNELS.listAgentRuns, () =>
    dataSource.listAgentRuns(),
  );
}

export function removeTaskHandlers(): void {
  ipcMain.removeHandler(TASKS_IPC_CHANNELS.listAgentRuns);
}
