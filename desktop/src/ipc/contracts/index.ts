export type { AppInfo, DesktopApi } from './app.contract'
export { IPC_CHANNELS } from './app.contract'
export type {
  AgentSecretBinding,
  AutomationAgent,
  AutomationApi,
  AutomationScenario,
  AutomationScenarioEdge,
  AutomationScenarioGraph,
  AutomationScenarioNode,
  AutomationScenarioNodeKind,
  AutomationScenarioToolSetting,
  AutomationSnapshot,
  AutomationStatus,
  AutomationTool,
  UpsertAutomationAgentInput,
  UpsertAutomationScenarioInput
} from './automation.contract'
export { AUTOMATION_IPC_CHANNELS } from './automation.contract'
export type {
  SecretCategory,
  SecretEntity,
  SecretStorageApi,
  SecretStorageSnapshot,
  UpsertSecretCategoryInput,
  UpsertSecretInput
} from './secrets.contract'
export { SECRET_IPC_CHANNELS } from './secrets.contract'
export type {
  TestTextProviderConnectionInput,
  TestTextProviderConnectionResult,
  TextProviderApi,
  TextProviderKind,
  TextProviderModelDetails,
  TextProviderModelInfo
} from './text-provider.contract'
export { TEXT_PROVIDER_IPC_CHANNELS } from './text-provider.contract'
