export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
  openAppLocation: "app:open-location",
  writeClipboardText: "app:write-clipboard-text",
  command: "app:command",
  saveGeneratedArtifact: "app:save-generated-artifact",
  selectDirectory: "app:select-directory",
  getApplicationSettings: "app:get-application-settings",
  updateApplicationSettings: "app:update-application-settings",
} as const;

export type AppCommand =
  | "new-chat"
  | "open-tasks"
  | "open-scenarios"
  | "open-settings";

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  arch: string;
  updatedAt: string;
  installPath: string;
  userDataPath: string;
}

export type AppLocation = "install" | "userData";

export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>;
  openAppLocation(location: AppLocation): Promise<void>;
  writeClipboardText(text: string): Promise<void>;
  subscribeToCommands(listener: (command: AppCommand) => void): () => void;
  saveGeneratedArtifact(input: GeneratedArtifactInput): Promise<boolean>;
  selectDirectory(): Promise<string | null>;
  applicationSettings: ApplicationSettingsApi;
  dataTransfer: import("./data-transfer.contract").DataTransferApi;
  secrets: import("./secrets.contract").SecretStorageApi;
  automation: import("./automation.contract").AutomationApi;
  textProviders: import("./text-provider.contract").TextProviderApi;
  vectorStores: import("./vector-store.contract").VectorStoreApi;
  chat: import("./chat.contract").ChatApi;
  projects: import("./project.contract").ProjectApi;
  extensions: import("./extension.contract").ExtensionApi;
  tasks: import("./tasks.contract").TasksApi;
  terminalPolicy: import("./terminal-policy.contract").TerminalPolicyApi;
  directoryPolicy: import("./directory-policy.contract").DirectoryPolicyApi;
  integrations: import("./integration.contract").IntegrationApi;
  userProfile: import("./user-profile.contract").UserProfileApi;
  entityGeneration: import("./entity-generation.contract").EntityGenerationApi;
  core: import("./core-interactor.contract").CoreInteractorApi;
  assistant: import("./assistant.contract").AssistantApi;
  mcp: import("./mcp.contract").McpApi;
  zvsId: import("./zvs-id.contract").ZvsIdApi;
}

export interface ApplicationSettingsApi {
  get(): Promise<ApplicationSettings>;
  update(input: UpdateApplicationSettingsInput): Promise<ApplicationSettings>;
}

export interface GeneratedArtifactInput {
  path: string;
  fileName: string;
}
import type {
  ApplicationSettings,
  UpdateApplicationSettingsInput,
} from "../../shared/dto";

export type {
  ApplicationSettings,
  OnboardingState,
  UpdateApplicationSettingsInput,
} from "../../shared/dto";
