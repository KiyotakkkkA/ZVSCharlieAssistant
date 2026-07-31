import { ipcMain } from "electron";
import type { AutomationRepository } from "../../host/domain/repositories/automation.repository";
import {
  AUTOMATION_IPC_CHANNELS,
  type UpsertAutomationAgentInput,
  type UpsertAutomationScenarioInput,
} from "../contracts";

export function registerAutomationHandlers(
  repository: AutomationRepository,
): void {
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.getSnapshot, () =>
    repository.getSnapshot(),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertAgent,
    (_event, input: UpsertAutomationAgentInput) =>
      repository.upsertAgent(input),
  );
  ipcMain.handle(AUTOMATION_IPC_CHANNELS.deleteAgent, (_event, id: string) =>
    repository.deleteAgent(id),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.upsertScenario,
    (_event, input: UpsertAutomationScenarioInput) =>
      repository.upsertScenario(input),
  );
  ipcMain.handle(
    AUTOMATION_IPC_CHANNELS.deleteScenario,
    (_event, id: string) => repository.deleteScenario(id),
  );
}

export function removeAutomationHandlers(): void {
  for (const channel of Object.values(AUTOMATION_IPC_CHANNELS))
    ipcMain.removeHandler(channel);
}
