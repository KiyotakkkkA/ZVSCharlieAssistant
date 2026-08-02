import { ipcRenderer } from "electron";
import {
  AUTOMATION_IPC_CHANNELS,
  IPC_CHANNELS,
  SECRET_IPC_CHANNELS,
  TEXT_PROVIDER_IPC_CHANNELS,
  CHAT_IPC_CHANNELS,
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
  type TestTextProviderConnectionInput,
  type TestTextProviderConnectionResult,
  type ChatSnapshot,
  type ChatMessagePage,
  type RunEvent,
  type StartRunInput,
  type TextProviderSnapshot,
  type UpsertTextProviderInput,
  type AutomationScenarioGraph,
  type ScenarioRun,
  type ScenarioRunEvent,
  type ScenarioRunOrigin,
  type ScenarioNodeRun,
  type ScenarioValidationResult,
  type UpsertAutomationToolSecretBindingInput,
  type AutomationTool,
  VECTOR_STORE_IPC_CHANNELS,
  type VectorStoreSnapshot,
  type UpsertVectorStoreInput,
  type UploadVectorDocumentInput,
  type VectorSearchInput,
  type VectorSearchResultItem,
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
    copySecret: (id: number): Promise<void> =>
      ipcRenderer.invoke(SECRET_IPC_CHANNELS.copySecret, id) as Promise<void>,
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
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.deleteAgent,
        id,
      ) as Promise<void>,
    upsertToolSecretBinding: (
      input: UpsertAutomationToolSecretBindingInput,
    ): Promise<AutomationTool> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.upsertToolSecretBinding,
        input,
      ) as Promise<AutomationTool>,
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
    validateScenario: (
      graph: AutomationScenarioGraph,
    ): Promise<ScenarioValidationResult> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.validateScenario,
        graph,
      ) as Promise<ScenarioValidationResult>,
    startScenario: (
      id: string,
      input: unknown,
      origin: ScenarioRunOrigin = "manual",
    ): Promise<ScenarioRun> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.startScenario,
        id,
        input,
        origin,
      ) as Promise<ScenarioRun>,
    cancelScenarioRun: (id: number): Promise<void> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.cancelScenarioRun,
        id,
      ) as Promise<void>,
    approveScenarioRun: (id: number, approved: boolean): Promise<void> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.approveScenarioRun,
        id,
        approved,
      ) as Promise<void>,
    getScenarioRun: (
      id: number,
    ): Promise<{ run: ScenarioRun; nodes: ScenarioNodeRun[] }> =>
      ipcRenderer.invoke(
        AUTOMATION_IPC_CHANNELS.getScenarioRun,
        id,
      ) as Promise<{ run: ScenarioRun; nodes: ScenarioNodeRun[] }>,
    subscribeScenarioRuns: (listener: (event: ScenarioRunEvent) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: ScenarioRunEvent,
      ) => listener(payload);
      ipcRenderer.on(AUTOMATION_IPC_CHANNELS.scenarioRunEvent, handler);
      return () =>
        ipcRenderer.removeListener(
          AUTOMATION_IPC_CHANNELS.scenarioRunEvent,
          handler,
        );
    },
  },
  textProviders: {
    getSnapshot: (): Promise<TextProviderSnapshot> =>
      ipcRenderer.invoke(
        TEXT_PROVIDER_IPC_CHANNELS.getSnapshot,
      ) as Promise<TextProviderSnapshot>,
    testConnection: (
      input: TestTextProviderConnectionInput,
    ): Promise<TestTextProviderConnectionResult> =>
      ipcRenderer.invoke(
        TEXT_PROVIDER_IPC_CHANNELS.testConnection,
        input,
      ) as Promise<TestTextProviderConnectionResult>,
    upsertProvider: (
      input: UpsertTextProviderInput,
    ): Promise<TextProviderSnapshot> =>
      ipcRenderer.invoke(
        TEXT_PROVIDER_IPC_CHANNELS.upsertProvider,
        input,
      ) as Promise<TextProviderSnapshot>,
    deleteProvider: (id: number): Promise<TextProviderSnapshot> =>
      ipcRenderer.invoke(
        TEXT_PROVIDER_IPC_CHANNELS.deleteProvider,
        id,
      ) as Promise<TextProviderSnapshot>,
  },
  vectorStores: {
    getSnapshot: (): Promise<VectorStoreSnapshot> =>
      ipcRenderer.invoke(
        VECTOR_STORE_IPC_CHANNELS.getSnapshot,
      ) as Promise<VectorStoreSnapshot>,
    upsertStore: (
      input: UpsertVectorStoreInput,
    ): Promise<VectorStoreSnapshot> =>
      ipcRenderer.invoke(
        VECTOR_STORE_IPC_CHANNELS.upsertStore,
        input,
      ) as Promise<VectorStoreSnapshot>,
    deleteStore: (id: number): Promise<VectorStoreSnapshot> =>
      ipcRenderer.invoke(
        VECTOR_STORE_IPC_CHANNELS.deleteStore,
        id,
      ) as Promise<VectorStoreSnapshot>,
    uploadDocuments: (
      input: UploadVectorDocumentInput[],
    ): Promise<VectorStoreSnapshot> =>
      ipcRenderer.invoke(
        VECTOR_STORE_IPC_CHANNELS.uploadDocuments,
        input,
      ) as Promise<VectorStoreSnapshot>,
    deleteDocument: (id: number): Promise<VectorStoreSnapshot> =>
      ipcRenderer.invoke(
        VECTOR_STORE_IPC_CHANNELS.deleteDocument,
        id,
      ) as Promise<VectorStoreSnapshot>,
    search: (input: VectorSearchInput): Promise<VectorSearchResultItem[]> =>
      ipcRenderer.invoke(VECTOR_STORE_IPC_CHANNELS.search, input) as Promise<
        VectorSearchResultItem[]
      >,
  },
  chat: {
    getSnapshot: (id?: number): Promise<ChatSnapshot> =>
      ipcRenderer.invoke(
        CHAT_IPC_CHANNELS.getSnapshot,
        id,
      ) as Promise<ChatSnapshot>,
    getMessagesPage: (
      id: number,
      beforeId?: number,
    ): Promise<ChatMessagePage> =>
      ipcRenderer.invoke(
        CHAT_IPC_CHANNELS.getMessagesPage,
        id,
        beforeId,
      ) as Promise<ChatMessagePage>,
    startRun: (
      input: StartRunInput,
    ): Promise<{ runId: number; conversationId: number }> =>
      ipcRenderer.invoke(CHAT_IPC_CHANNELS.startRun, input) as Promise<{
        runId: number;
        conversationId: number;
      }>,
    cancelRun: (id: number): Promise<void> =>
      ipcRenderer.invoke(CHAT_IPC_CHANNELS.cancelRun, id) as Promise<void>,
    deleteConversation: (id: number): Promise<void> =>
      ipcRenderer.invoke(
        CHAT_IPC_CHANNELS.deleteConversation,
        id,
      ) as Promise<void>,
    renameConversation: (id: number, title: string): Promise<void> =>
      ipcRenderer.invoke(
        CHAT_IPC_CHANNELS.renameConversation,
        id,
        title,
      ) as Promise<void>,
    subscribe: (listener: (event: RunEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: RunEvent) =>
        listener(payload);
      ipcRenderer.on(CHAT_IPC_CHANNELS.event, handler);
      return () => ipcRenderer.removeListener(CHAT_IPC_CHANNELS.event, handler);
    },
  },
};
