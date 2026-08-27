import { makeAutoObservable, runInAction } from "mobx";
import { parseIpcDto, startRunDtoSchema } from "../../shared/dto";
import type {
  ChatConversation,
  ChatMessage,
  ContextSegment,
  ContextWindow,
  FileEditRecord,
  ModelSwitch,
  RunEvent,
  ScenarioNodeRun,
  ScenarioRun,
} from "../../ipc/contracts";
import type {
  ChatMessageContentPart,
  JsonValue,
  StartRunInput,
} from "../../shared/dto";

class ChatStore {
  conversations: ChatConversation[] = [];
  messages: ChatMessage[] = [];
  activeConversationId: string | null = null;
  activeRunId: string | null = null;
  loading = false;
  hasMoreMessages = false;
  loadingEarlier = false;
  activeScenarioRun: ScenarioRun | null = null;
  scenarioNodeRuns: ScenarioNodeRun[] = [];
  scenarioNodeOutput = new Map<string, string>();
  scenarioExecutions = new Map<
    string,
    { run: ScenarioRun; nodes: ScenarioNodeRun[] }
  >();
  pendingScenarioApproval: {
    runId: string;
    nodeId: string;
    prompt: string;
  } | null = null;
  segments: ContextSegment[] = [];
  contextWindow: ContextWindow | null = null;
  fileEdits: FileEditRecord[] = [];
  compacting = false;
  modelSwitches: ModelSwitch[] = [];
  showCompacted = false;
  private unsubscribe?: () => void;
  private readonly pendingTextDeltas = new Map<string, string>();
  private readonly pendingReasoningDeltas = new Map<string, string>();
  private readonly pendingContentDeltas: Array<{
    messageId: string;
    type: "text" | "reasoning";
    delta: string;
  }> = [];
  private readonly pendingScenarioDeltas = new Map<string, string>();
  private deltaTimer: number | null = null;

  constructor() {
    makeAutoObservable<
      this,
      | "unsubscribe"
      | "pendingTextDeltas"
      | "pendingReasoningDeltas"
      | "pendingContentDeltas"
      | "pendingScenarioDeltas"
      | "deltaTimer"
    >(
      this,
      {
        unsubscribe: false,
        pendingTextDeltas: false,
        pendingReasoningDeltas: false,
        pendingContentDeltas: false,
        pendingScenarioDeltas: false,
        deltaTimer: false,
      },
      { autoBind: true },
    );
  }

  async bootstrap() {
    const snapshot = await window.desktop.chat.getSnapshot();
    runInAction(() => {
      this.conversations = snapshot.conversations;
      this.messages = snapshot.messages;
      this.activeConversationId = snapshot.conversations[0]?.id ?? null;
      this.hasMoreMessages = snapshot.hasMoreMessages;
      this.segments = snapshot.segments;
      this.scenarioExecutions.clear();
    });
    if (this.activeConversationId)
      void this.refreshFileEdits(this.activeConversationId);
    this.unsubscribe?.();
    this.unsubscribe = window.desktop.chat.subscribe(this.handleEvent);
    await this.hydrateScenarioExecutions(snapshot.messages);
  }

  async start(input: Omit<StartRunInput, "conversationId">) {
    this.loading = true;
    try {
      await window.desktop.chat.startRun(
        parseIpcDto(startRunDtoSchema, {
          ...input,
          conversationId: this.activeConversationId ?? undefined,
        }),
      );
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async cancel() {
    if (this.activeRunId) await window.desktop.chat.cancelRun(this.activeRunId);
  }

  async renameConversation(id: string, title: string) {
    await window.desktop.chat.renameConversation(id, title);
    await this.refreshConversations();
  }

  async deleteConversation(id: string) {
    await window.desktop.chat.deleteConversation(id);
    const next = this.conversations.find((item) => item.id !== id);
    if (next) await this.select(next.id);
    else runInAction(() => this.newConversation());
    await this.refreshConversations();
  }

  async truncateMessages(fromMessageId: string) {
    const conversationId = this.activeConversationId;
    if (!conversationId) throw new Error("Диалог не выбран");
    if (this.activeRunId)
      throw new Error("Дождитесь завершения текущего ответа");
    await window.desktop.chat.truncateMessages(conversationId, fromMessageId);
    runInAction(() => {
      const removed = this.messages.filter(
        (message) => message.id >= fromMessageId,
      );
      this.messages = this.messages.filter(
        (message) => message.id < fromMessageId,
      );
      for (const message of removed)
        if (message.scenarioRunId)
          this.scenarioExecutions.delete(message.scenarioRunId);
    });
    await this.refreshConversations();
  }

  async compact(modelId: string, focus?: string) {
    const conversationId = this.activeConversationId;
    if (!conversationId) throw new Error("Диалог не выбран");
    if (this.activeRunId) throw new Error("Дождитесь завершения ответа");
    this.compacting = true;
    try {
      await window.desktop.chat.compactConversation(
        conversationId,
        modelId,
        focus,
      );
      await this.select(conversationId);
      await this.refreshContextWindow(modelId);
    } finally {
      runInAction(() => {
        this.compacting = false;
      });
    }
  }

  async refreshContextWindow(modelId: string) {
    const conversationId = this.activeConversationId;
    if (!conversationId || !modelId) return;
    try {
      const window_ = await window.desktop.chat.contextWindow(
        conversationId,
        modelId,
      );
      runInAction(() => {
        this.contextWindow = window_;
      });
    } catch {
      runInAction(() => {
        this.contextWindow = null;
      });
    }
  }

  toggleCompacted() {
    this.showCompacted = !this.showCompacted;
  }

  async refreshFileEdits(conversationId: string) {
    const edits = await window.desktop.chat.listFileEdits(conversationId);
    runInAction(() => {
      this.fileEdits = edits;
    });
  }

  async revertRun(runId: string) {
    const result = await window.desktop.chat.revertRun(runId);
    if (this.activeConversationId)
      await this.refreshFileEdits(this.activeConversationId);
    return result;
  }

  newConversation() {
    this.resetPendingDeltas();
    this.activeConversationId = null;
    this.messages = [];
    this.segments = [];
    this.contextWindow = null;
    this.fileEdits = [];
    this.modelSwitches = [];
    this.activeRunId = null;
    this.hasMoreMessages = false;
    this.activeScenarioRun = null;
    this.scenarioNodeRuns = [];
    this.scenarioNodeOutput.clear();
    this.scenarioExecutions.clear();
  }

  async select(id: string) {
    this.resetPendingDeltas();
    const snapshot = await window.desktop.chat.getSnapshot(id);
    runInAction(() => {
      this.activeConversationId = id;
      this.conversations = snapshot.conversations;
      this.messages = snapshot.messages;
      this.hasMoreMessages = snapshot.hasMoreMessages;
      this.segments = snapshot.segments;
      this.activeScenarioRun = null;
      this.scenarioNodeRuns = [];
      this.scenarioNodeOutput.clear();
      this.scenarioExecutions.clear();
    });
    void this.refreshFileEdits(id);
    await this.hydrateScenarioExecutions(snapshot.messages);
  }

  async loadEarlier() {
    if (
      this.loadingEarlier ||
      !this.hasMoreMessages ||
      !this.activeConversationId ||
      !this.messages[0]
    )
      return;
    this.loadingEarlier = true;
    try {
      const page = await window.desktop.chat.getMessagesPage(
        this.activeConversationId,
        this.messages[0].id,
      );
      runInAction(() => {
        this.messages = [...page.messages, ...this.messages];
        this.hasMoreMessages = page.hasMore;
      });
      await this.hydrateScenarioExecutions(page.messages);
    } finally {
      runInAction(() => {
        this.loadingEarlier = false;
      });
    }
  }

  private handleEvent(event: RunEvent) {
    runInAction(() => {
      if (event.type === "run.started") {
        const conversationChanged =
          this.activeConversationId !== null &&
          this.activeConversationId !== event.conversationId;
        if (conversationChanged) {
          this.resetPendingDeltas();
          this.messages = [];
          this.segments = [];
          this.contextWindow = null;
          this.fileEdits = [];
          this.modelSwitches = [];
          this.activeScenarioRun = null;
          this.scenarioNodeRuns = [];
          this.scenarioNodeOutput.clear();
          this.scenarioExecutions.clear();
        }
        this.activeRunId = event.runId;
        this.activeConversationId = event.conversationId;
        this.messages = [
          ...this.messages,
          event.userMessage,
          event.assistantMessage,
        ];
        void this.refreshConversations();
      } else if (event.type === "scenario.run") {
        if (this.activeScenarioRun?.id !== event.run.id) {
          this.scenarioNodeRuns = [];
          this.scenarioNodeOutput.clear();
        }
        this.activeScenarioRun = event.run;
        const assistant = [...this.messages]
          .reverse()
          .find(
            (message) =>
              message.role === "assistant" && message.status === "streaming",
          );
        if (assistant && assistant.scenarioRunId === null)
          this.messages = this.messages.map((message) =>
            message.id === assistant.id
              ? { ...message, scenarioRunId: event.run.id }
              : message,
          );
        this.scenarioExecutions.set(event.run.id, {
          run: event.run,
          nodes: [...this.scenarioNodeRuns],
        });
      } else if (event.type === "scenario.node") {
        if (this.activeScenarioRun?.id !== event.runId) return;
        const index = this.scenarioNodeRuns.findIndex(
          (item) => item.id === event.node.id,
        );
        if (index >= 0) this.scenarioNodeRuns[index] = event.node;
        else this.scenarioNodeRuns.push(event.node);
        if (this.activeScenarioRun)
          this.scenarioExecutions.set(event.runId, {
            run: this.activeScenarioRun,
            nodes: [...this.scenarioNodeRuns],
          });
      } else if (event.type === "scenario.node.delta") {
        if (this.activeScenarioRun?.id !== event.runId) return;
        this.pendingScenarioDeltas.set(
          event.nodeId,
          (this.pendingScenarioDeltas.get(event.nodeId) ?? "") + event.delta,
        );
        this.scheduleDeltaFlush();
      } else if (event.type === "scenario.approval.required") {
        this.pendingScenarioApproval = event;
      } else if (event.type === "text.delta") {
        this.pendingTextDeltas.set(
          event.messageId,
          (this.pendingTextDeltas.get(event.messageId) ?? "") + event.delta,
        );
        this.pendingContentDeltas.push({
          messageId: event.messageId,
          type: "text",
          delta: event.delta,
        });
        this.scheduleDeltaFlush();
      } else if (event.type === "reasoning.delta") {
        this.pendingReasoningDeltas.set(
          event.messageId,
          (this.pendingReasoningDeltas.get(event.messageId) ?? "") +
            event.delta,
        );
        this.pendingContentDeltas.push({
          messageId: event.messageId,
          type: "reasoning",
          delta: event.delta,
        });
        this.scheduleDeltaFlush();
      } else if (
        event.type === "tool.requested" ||
        event.type === "tool.running" ||
        event.type === "tool.completed"
      ) {
        this.flushPendingDeltas();
        this.messages = this.messages.map((message) => {
          if (message.role !== "assistant" || message.runId !== event.runId)
            return message;
          const existing = message.toolCalls.find(
            (call) => call.id === event.toolCallId,
          );
          const status: import("../../ipc/contracts").ChatToolCall["status"] =
            event.error
              ? "failed"
              : event.type === "tool.completed"
                ? "completed"
                : event.type === "tool.running"
                  ? "running"
                  : "requested";
          const next = {
            id: event.toolCallId,
            toolId: event.toolId,
            status,
            input: event.input ?? existing?.input ?? null,
            output: event.output ?? existing?.output ?? null,
            error: event.error ?? existing?.error ?? null,
          };
          let parts = message.parts;
          const hasCallPart = parts.some(
            (part) =>
              part.type === "tool-call" && part.toolCallId === event.toolCallId,
          );
          if (!hasCallPart) {
            parts = [
              ...parts,
              {
                type: "tool-call",
                toolCallId: event.toolCallId,
                toolName: event.toolId,
                input: (event.input ?? null) as JsonValue,
              },
            ];
          }
          const hasResultPart = parts.some(
            (part) =>
              part.type === "tool-result" &&
              part.toolCallId === event.toolCallId,
          );
          if (event.type === "tool.completed" && !hasResultPart) {
            parts = [
              ...parts,
              {
                type: "tool-result",
                toolCallId: event.toolCallId,
                toolName: event.toolId,
                output: (event.error
                  ? { error: event.error }
                  : (event.output ?? null)) as JsonValue,
                isError: Boolean(event.error) || undefined,
              },
            ];
          }
          return {
            ...message,
            parts,
            toolCalls: existing
              ? message.toolCalls.map((call) =>
                  call.id === next.id ? next : call,
                )
              : [...message.toolCalls, next],
          };
        });
      } else if (event.type === "context.window") {
        this.contextWindow = event.window;
      } else if (event.type === "context.compacted") {
        this.segments = [
          ...this.segments.filter((item) => item.id !== event.segment.id),
          event.segment,
        ];
        this.messages = this.messages.map((message) =>
          message.id >= event.segment.fromMessageId &&
          message.id <= event.segment.toMessageId
            ? { ...message, compactedInto: event.segment.id }
            : message,
        );
      } else if (event.type === "file.changed") {
        this.fileEdits = [
          ...this.fileEdits.filter((item) => item.id !== event.edit.id),
          event.edit,
        ];
      } else if (event.type === "run.model.switched") {
        this.modelSwitches = [...this.modelSwitches, event.change];
      } else if (event.type === "run.usage") {
        void this.refreshConversations();
      } else if (
        event.type === "run.completed" ||
        event.type === "run.cancelled" ||
        event.type === "run.failed"
      ) {
        this.flushPendingDeltas();
        this.activeRunId = null;
        const status =
          event.type === "run.completed"
            ? "completed"
            : event.type === "run.cancelled"
              ? "cancelled"
              : "failed";
        this.messages = this.messages.map((message) =>
          message.role === "assistant" &&
          (message.runId === event.runId ||
            message.scenarioRunId === event.runId)
            ? {
                ...message,
                status,
                error: event.type === "run.failed" ? event.message : null,
              }
            : message,
        );
      }
    });
  }

  private scheduleDeltaFlush() {
    if (this.deltaTimer !== null) return;
    this.deltaTimer = window.setTimeout(this.flushPendingDeltas, 40);
  }

  private flushPendingDeltas() {
    if (this.deltaTimer !== null) clearTimeout(this.deltaTimer);
    this.deltaTimer = null;
    if (this.pendingTextDeltas.size || this.pendingReasoningDeltas.size) {
      const text = new Map(this.pendingTextDeltas);
      const reasoning = new Map(this.pendingReasoningDeltas);
      const content = [...this.pendingContentDeltas];
      this.pendingTextDeltas.clear();
      this.pendingReasoningDeltas.clear();
      this.pendingContentDeltas.length = 0;
      this.messages = this.messages.map((message) => {
        const textDelta = text.get(message.id);
        const reasoningDelta = reasoning.get(message.id);
        const messageContent = content.filter(
          (delta) => delta.messageId === message.id,
        );
        return textDelta || reasoningDelta
          ? {
              ...message,
              text: message.text + (textDelta ?? ""),
              reasoning: message.reasoning + (reasoningDelta ?? ""),
              parts: messageContent.reduce(
                (parts, delta) =>
                  appendContentDelta(parts, delta.type, delta.delta),
                message.parts,
              ),
            }
          : message;
      });
    }
    for (const [nodeId, delta] of this.pendingScenarioDeltas) {
      this.scenarioNodeOutput.set(
        nodeId,
        (this.scenarioNodeOutput.get(nodeId) ?? "") + delta,
      );
    }
    this.pendingScenarioDeltas.clear();
  }

  private resetPendingDeltas() {
    if (this.deltaTimer !== null) clearTimeout(this.deltaTimer);
    this.deltaTimer = null;
    this.pendingTextDeltas.clear();
    this.pendingReasoningDeltas.clear();
    this.pendingContentDeltas.length = 0;
    this.pendingScenarioDeltas.clear();
  }

  async approveScenario(approved: boolean) {
    if (!this.pendingScenarioApproval) return;
    await window.desktop.automation.approveScenarioRun(
      this.pendingScenarioApproval.runId,
      approved,
    );
    runInAction(() => {
      this.pendingScenarioApproval = null;
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

  private async hydrateScenarioExecutions(messages: ChatMessage[]) {
    const runIds = [
      ...new Set(
        messages
          .map((message) => message.scenarioRunId)
          .filter((id): id is string => typeof id === "string"),
      ),
    ].filter((id) => !this.scenarioExecutions.has(id));
    const executions = await Promise.allSettled(
      runIds.map((id) => window.desktop.automation.getScenarioRun(id)),
    );
    runInAction(() => {
      for (const result of executions)
        if (result.status === "fulfilled")
          this.scenarioExecutions.set(result.value.run.id, result.value);
    });
  }
}
export const chatStore = new ChatStore();

function appendContentDelta(
  parts: ChatMessageContentPart[],
  type: "text" | "reasoning",
  delta: string,
): ChatMessageContentPart[] {
  if (!delta) return parts;
  const last = parts.at(-1);
  if (last?.type === type) {
    return [...parts.slice(0, -1), { ...last, text: last.text + delta }];
  }
  return [...parts, { type, text: delta }];
}
