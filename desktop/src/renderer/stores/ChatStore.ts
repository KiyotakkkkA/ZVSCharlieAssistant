import { makeAutoObservable, runInAction } from "mobx";
import type {
  ChatConversation,
  ChatMessage,
  RunEvent,
  StartRunInput,
} from "../../ipc/contracts";
export class ChatStore {
  conversations: ChatConversation[] = [];
  messages: ChatMessage[] = [];
  activeConversationId: number | null = null;
  activeRunId: number | null = null;
  pendingApproval: Extract<RunEvent, { type: "approval.required" }> | null =
    null;
  loading = false;
  hasMoreMessages = false;
  loadingEarlier = false;
  private unsubscribe?: () => void;
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }
  async bootstrap() {
    const snapshot = await window.desktop.chat.getSnapshot();
    runInAction(() => {
      this.conversations = snapshot.conversations;
      this.messages = snapshot.messages;
      this.activeConversationId = snapshot.conversations[0]?.id ?? null;
      this.hasMoreMessages = snapshot.hasMoreMessages;
    });
    this.unsubscribe?.();
    this.unsubscribe = window.desktop.chat.subscribe(this.handleEvent);
  }
  async start(input: Omit<StartRunInput, "conversationId">) {
    this.loading = true;
    try {
      await window.desktop.chat.startRun({
        ...input,
        conversationId: this.activeConversationId ?? undefined,
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }
  async cancel() {
    if (this.activeRunId) await window.desktop.chat.cancelRun(this.activeRunId);
  }
  async approve(approved: boolean) {
    if (!this.pendingApproval) return;
    await window.desktop.chat.approveToolCall(
      this.pendingApproval.toolCallId,
      approved,
    );
    runInAction(() => {
      this.pendingApproval = null;
    });
  }
  async renameConversation(id: number, title: string) {
    await window.desktop.chat.renameConversation(id, title);
    await this.refreshConversations();
  }
  async deleteConversation(id: number) {
    await window.desktop.chat.deleteConversation(id);
    const next = this.conversations.find((item) => item.id !== id);
    if (next) await this.select(next.id);
    else runInAction(() => this.newConversation());
    await this.refreshConversations();
  }
  newConversation() {
    this.activeConversationId = null;
    this.messages = [];
    this.activeRunId = null;
    this.hasMoreMessages = false;
  }
  async select(id: number) {
    const snapshot = await window.desktop.chat.getSnapshot(id);
    runInAction(() => {
      this.activeConversationId = id;
      this.conversations = snapshot.conversations;
      this.messages = snapshot.messages;
      this.hasMoreMessages = snapshot.hasMoreMessages;
    });
  }
  async loadEarlier(){if(this.loadingEarlier||!this.hasMoreMessages||!this.activeConversationId||!this.messages[0])return;this.loadingEarlier=true;try{const page=await window.desktop.chat.getMessagesPage(this.activeConversationId,this.messages[0].id);runInAction(()=>{this.messages.unshift(...page.messages);this.hasMoreMessages=page.hasMore;});}finally{runInAction(()=>{this.loadingEarlier=false;});}}
  private handleEvent(event: RunEvent) {
    runInAction(() => {
      if (event.type === "run.started") {
        this.activeRunId = event.runId;
        this.activeConversationId = event.conversationId;
        this.messages.push(event.userMessage, event.assistantMessage);
        void this.refreshConversations();
      } else if (event.type === "text.delta") {
        const message = this.messages.find(
          (item) => item.id === event.messageId,
        );
        if (message) message.text += event.delta;
      } else if (event.type === "reasoning.delta") {
        const message = this.messages.find(
          (item) => item.id === event.messageId,
        );
        if (message) message.reasoning += event.delta;
      } else if (event.type === "approval.required")
        this.pendingApproval = event;
      else if (
        event.type === "run.completed" ||
        event.type === "run.cancelled" ||
        event.type === "run.failed"
      )
        this.activeRunId = null;
    });
  }
  private async refreshConversations() {
    const snapshot = await window.desktop.chat.getSnapshot(
      this.activeConversationId ?? undefined,
    );
    runInAction(() => {
      this.conversations = snapshot.conversations;
    });
  }
}
export const chatStore = new ChatStore();
