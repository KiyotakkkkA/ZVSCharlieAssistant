export const IPC_CHANNELS = {
  getAppInfo: "app:get-info",
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
  | "open-settings"
  | "start-onboarding"
  | "open-home";

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

export interface DesktopApi {
  getAppInfo(): Promise<AppInfo>;
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
  tasks: import("./tasks.contract").TasksApi;
  terminalPolicy: import("./terminal-policy.contract").TerminalPolicyApi;
  directoryPolicy: import("./directory-policy.contract").DirectoryPolicyApi;
  integrations: import("./integration.contract").IntegrationApi;
  userProfile: import("./user-profile.contract").UserProfileApi;
  entityGeneration: import("./entity-generation.contract").EntityGenerationApi;
  core: import("./core-interactor.contract").CoreInteractorApi;
  assistant: import("./assistant.contract").AssistantApi;
}

export interface OnboardingState {
  version: number;
  wizardCompleted: boolean;
  tourCompleted: boolean;
  checklistDismissed: boolean;
  completedSteps: string[];
  firstLaunchAt: string | null;
}

export interface ApplicationSettings {
  runInBackground: boolean;
  onboarding: OnboardingState;
}

export interface UpdateApplicationSettingsInput {
  runInBackground?: boolean;
  onboarding?: Partial<OnboardingState>;
}

export interface ApplicationSettingsApi {
  get(): Promise<ApplicationSettings>;
  update(input: UpdateApplicationSettingsInput): Promise<ApplicationSettings>;
}

export interface GeneratedArtifactInput {
  path: string;
  fileName: string;
}
