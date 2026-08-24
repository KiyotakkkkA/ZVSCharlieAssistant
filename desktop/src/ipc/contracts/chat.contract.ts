import type {
  ChatMessagePage,
  ChatSnapshot,
  ContextSegment,
  FileEditRecord,
  RunEvent,
} from "../../shared/models/chat";
import type { ContextWindow, StartRunInput } from "../../shared/dto";

export type * from "../../shared/models/chat";

export interface ChatApi {
  getSnapshot(conversationId?: string): Promise<ChatSnapshot>;
  getMessagesPage(
    conversationId: string,
    beforeId?: string,
  ): Promise<ChatMessagePage>;
  startRun(
    input: StartRunInput,
  ): Promise<{ runId: string; conversationId: string }>;
  cancelRun(runId: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  renameConversation(id: string, title: string): Promise<void>;
  truncateMessages(
    conversationId: string,
    fromMessageId: string,
  ): Promise<void>;
  compactConversation(
    conversationId: string,
    modelId: string,
    focus?: string,
  ): Promise<ContextSegment | null>;
  contextWindow(
    conversationId: string,
    modelId: string,
  ): Promise<ContextWindow>;
  listFileEdits(conversationId: string): Promise<FileEditRecord[]>;
  revertRun(runId: string): Promise<{ restored: string[]; failed: string[] }>;
  subscribe(listener: (event: RunEvent) => void): () => void;
}

export const CHAT_IPC_CHANNELS = {
  getSnapshot: "chat:get-snapshot",
  getMessagesPage: "chat:get-messages-page",
  startRun: "chat:start-run",
  cancelRun: "chat:cancel-run",
  deleteConversation: "chat:delete-conversation",
  renameConversation: "chat:rename-conversation",
  truncateMessages: "chat:truncate-messages",
  compactConversation: "chat:compact-conversation",
  contextWindow: "chat:context-window",
  listFileEdits: "chat:list-file-edits",
  revertRun: "chat:revert-run",
  event: "chat:event",
} as const;
