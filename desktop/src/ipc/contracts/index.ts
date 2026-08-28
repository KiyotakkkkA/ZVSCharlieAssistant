export type {
  AppCommand,
  AppInfo,
  AppLocation,
  ApplicationSettings,
  ApplicationSettingsApi,
  OnboardingState,
  DesktopApi,
  GeneratedArtifactInput,
  UpdateApplicationSettingsInput,
} from "./app.contract";
export { IPC_CHANNELS } from "./app.contract";

export type {
  AgentTaskRun,
  TaskRunKind,
  TaskRunOrigin,
  TaskRunStatus,
} from "./tasks.contract";
export { TASKS_IPC_CHANNELS } from "./tasks.contract";

export type {
  AutomationAgent,
  AutomationScenario,
  AutomationScenarioNodeKind,
  ScenarioNodeRun,
  ScenarioRun,
  ScenarioRunEvent,
  ScenarioRunOrigin,
  ScenarioValidationResult,
  AutomationSnapshot,
  AutomationSkill,
  AutomationTool,
} from "./automation.contract";
export { AUTOMATION_IPC_CHANNELS } from "./automation.contract";

export type {
  SecretCategory,
  SecretEntity,
  SecretStorageSnapshot,
} from "./secrets.contract";
export { SECRET_IPC_CHANNELS } from "./secrets.contract";
export type { DataTransferApi } from "./data-transfer.contract";
export { DATA_TRANSFER_IPC_CHANNELS } from "./data-transfer.contract";

export { TEXT_PROVIDER_IPC_CHANNELS } from "./text-provider.contract";

export type {
  ChatConversation,
  ChatMessage,
  ChatMessagePage,
  ChatSnapshot,
  ChatToolCall,
  ContextSegment,
  FileEditRecord,
  RunEvent,
} from "./chat.contract";
export type {
  ContextWindow,
  ContextWindowBreakdownEntry,
  ModelSwitch,
} from "../../shared/dto";
export { CHAT_IPC_CHANNELS } from "./chat.contract";

export type {
  Project,
  ProjectApi,
  ProjectRepositoryState,
} from "./project.contract";
export { PROJECT_IPC_CHANNELS } from "./project.contract";

export type { CliIntegrationStatus, ExtensionApi } from "./extension.contract";
export { EXTENSION_IPC_CHANNELS } from "./extension.contract";

export type {
  VectorStoreConfig,
  VectorStoreDocument,
  VectorStoreSnapshot,
  VectorSearchResultItem,
  VectorDirectoryPreview,
} from "./vector-store.contract";
export { VECTOR_STORE_IPC_CHANNELS } from "./vector-store.contract";

export type {
  TerminalPolicyApi,
  TerminalPolicy,
  TerminalApprovalRequest,
} from "./terminal-policy.contract";
export { TERMINAL_POLICY_IPC_CHANNELS } from "./terminal-policy.contract";
export type {
  DirectoryPolicyApi,
  DirectoryPolicy,
} from "./directory-policy.contract";
export { DIRECTORY_POLICY_IPC_CHANNELS } from "./directory-policy.contract";

export type { IntegrationApi } from "./integration.contract";
export { INTEGRATION_IPC_CHANNELS } from "./integration.contract";

export type { UserProfileApi, UserProfile } from "./user-profile.contract";
export { USER_PROFILE_IPC_CHANNELS } from "./user-profile.contract";

export type {
  EntityGenerationApi,
  EntityGenerationRun,
  EntityGenerationStatus,
  GeneratedEntityKind,
  GenerationRunEvent,
  GenerationTranscriptMessage,
  PendingGenerationQuestion,
} from "./entity-generation.contract";
export { ENTITY_GENERATION_IPC_CHANNELS } from "./entity-generation.contract";

export type { CoreInteractorApi } from "./core-interactor.contract";
export { CORE_INTERACTOR_IPC_CHANNELS } from "./core-interactor.contract";

export type { AssistantApi } from "./assistant.contract";
export { ASSISTANT_IPC_CHANNELS } from "./assistant.contract";

export type * from "../../shared/models/memory";
export type * from "../../shared/models/task-plan";
export type * from "../../shared/models/user-question";
