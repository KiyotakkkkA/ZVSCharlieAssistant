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
  automation: import("./automation.contract").AutomationApi;
  textProviders: import("./text-provider.contract").TextProviderApi;
  vectorStores: import("./vector-store.contract").VectorStoreApi;
  chat: import("./chat.contract").ChatApi;
}
