export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>;
  secrets: import("./secrets.contract").SecretStorageApi;
}
