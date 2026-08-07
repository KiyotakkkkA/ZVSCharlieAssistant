export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
  saveGeneratedArtifact: "app:save-generated-artifact",
  selectDirectory: "app:select-directory",
} as const;

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>;
  saveGeneratedArtifact(input: GeneratedArtifactInput): Promise<boolean>;
  selectDirectory(): Promise<string | null>;
  secrets: import("./secrets.contract").SecretStorageApi;
  automation: import("./automation.contract").AutomationApi;
  textProviders: import("./text-provider.contract").TextProviderApi;
  vectorStores: import("./vector-store.contract").VectorStoreApi;
  chat: import("./chat.contract").ChatApi;
  tasks: import("./tasks.contract").TasksApi;
  terminalPolicy: import("./terminal-policy.contract").TerminalPolicyApi;
  directoryPolicy: import("./directory-policy.contract").DirectoryPolicyApi;
  integrations: import("./integration.contract").IntegrationApi;
  core: import("./core-interactor.contract").CoreInteractorApi;
}

export interface GeneratedArtifactInput {
  path: string;
  fileName: string;
}
