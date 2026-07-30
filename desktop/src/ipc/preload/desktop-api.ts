import { ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  SECRET_IPC_CHANNELS,
  type AppInfo,
  type DesktopApi,
  type SecretCategory,
  type SecretEntity,
  type SecretStorageSnapshot,
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
};
