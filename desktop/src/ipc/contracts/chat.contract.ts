import type {
  ChatMessagePage,
  ChatSnapshot,
  RunEvent,
} from "../../shared/models/chat";
import type { StartRunInput } from "../../shared/dto";

export type * from "../../shared/models/chat";

export interface ChatApi {
  getSnapshot(conversationId?: number): Promise<ChatSnapshot>;
  getMessagesPage(
    conversationId: number,
    beforeId?: number,
  ): Promise<ChatMessagePage>;
  startRun(
    input: StartRunInput,
  ): Promise<{ runId: number; conversationId: number }>;
  cancelRun(runId: number): Promise<void>;
  deleteConversation(id: number): Promise<void>;
  renameConversation(id: number, title: string): Promise<void>;
  truncateMessages(
    conversationId: number,
    fromMessageId: number,
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
