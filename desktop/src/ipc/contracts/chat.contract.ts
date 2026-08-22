import type {
  ChatMessagePage,
  ChatSnapshot,
  RunEvent,
} from "../../shared/models/chat";
import type { StartRunInput } from "../../shared/dto";

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
  event: "chat:event",
} as const;
