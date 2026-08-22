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
  dataTransfer: import("./data-transfer.contract").DataTransferApi;
  secrets: import("./secrets.contract").SecretStorageApi;
  automation: import("./automation.contract").AutomationApi;
  textProviders: import("./text-provider.contract").TextProviderApi;
  vectorStores: import("./vector-store.contract").VectorStoreApi;
  chat: import("./chat.contract").ChatApi;
  tasks: import("./tasks.contract").TasksApi;
  terminalPolicy: import("./terminal-policy.contract").TerminalPolicyApi;
  directoryPolicy: import("./directory-policy.contract").DirectoryPolicyApi;
  integrations: import("./integration.contract").IntegrationApi;
  userProfile: import("./user-profile.contract").UserProfileApi;
  entityGeneration: import("./entity-generation.contract").EntityGenerationApi;
  core: import("./core-interactor.contract").CoreInteractorApi;
  assistant: import("./assistant.contract").AssistantApi;
}

export interface GeneratedArtifactInput {
  path: string;
  fileName: string;
}
