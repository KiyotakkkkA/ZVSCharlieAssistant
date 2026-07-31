import { ipcRenderer } from "electron";
import {
  AUTOMATION_IPC_CHANNELS,
  IPC_CHANNELS,
  SECRET_IPC_CHANNELS,
  type AppInfo,
  type AutomationAgent,
  type AutomationScenario,
  type AutomationSnapshot,
  type DesktopApi,
  type SecretCategory,
  type SecretEntity,
  type SecretStorageSnapshot,
  type UpsertAutomationAgentInput,
  type UpsertAutomationScenarioInput,
  type UpsertSecretCategoryInput,
  type UpsertSecretInput,
} from "../contracts";

export const desktopApi: DesktopApi = {
  getAppInfo: (): Promise<AppInfo> =>
    ipcRenderer.invoke(IPC_CHANNELS.getAppInfo) as Promise<AppInfo>,
  secrets: {
    getSnapshot: (): Promise<SecretStorageSnapshot> =>
      ipcRenderer.invoke(
        SECRET_IPC_CHANNELS.getSnapshot,
      ) as Promise<SecretStorageSnapshot>,
    upsertCategory: (
      input: UpsertSecretCategoryInput,
    ): Promise<SecretCategory> =>
      ipcRenderer.invoke(
        SECRET_IPC_CHANNELS.upsertCategory,
        input,
      ) as Promise<SecretCategory>,
    upsertSecret: (input: UpsertSecretInput): Promise<SecretEntity> =>
      ipcRenderer.invoke(
        SECRET_IPC_CHANNELS.upsertSecret,
        input,
      ) as Promise<SecretEntity>,
    deleteCategory: (id: number): Promise<void> =>
      ipcRenderer.invoke(
        SECRET_IPC_CHANNELS.deleteCategory,
        id,
      ) as Promise<void>,
    deleteSecret: (id: number): Promise<void> =>
      ipcRenderer.invoke(SECRET_IPC_CHANNELS.deleteSecret, id) as Promise<void>,
  },
  automation: {
    getSnapshot: (): Promise<AutomationSnapshot> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.getSnapshot,
      ) as Promise<AutomationSnapshot>,
    upsertAgent: (
      input: UpsertAutomationAgentInput,
    ): Promise<AutomationAgent> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.upsertAgent,
        input,
      ) as Promise<AutomationAgent>,
    deleteAgent: (id: string): Promise<void> =>
      ipcRenderer.invoke(AUTOMATION_IPC_CHANNELS.deleteAgent, id) as Promise<void>,
    upsertScenario: (
      input: UpsertAutomationScenarioInput,
    ): Promise<AutomationScenario> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.upsertScenario,
        input,
      ) as Promise<AutomationScenario>,
    deleteScenario: (id: string): Promise<void> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.deleteScenario,
        id,
      ) as Promise<void>,
  },
};
