import type { ChatMessageContentPart } from "../../../../shared/dto";
import type { ContextSegment } from "../../../../shared/models/chat";
import { InMemoryCompactor, type EnabledModelInfo } from "../../../application/context/generation-context";
import type { ContextBudget } from "../../../application/context/context-budget";
import type { ProviderRegistry } from "../../text-generation/provider.registry";
import type { ScenarioAgentConversationRepository } from "../../database/scenario-agent-conversation.repository";

export class DurableAgentContext {
  private constructor(
    private readonly repo: ScenarioAgentConversationRepository,
    readonly conversationId: string,
    readonly compactor: InMemoryCompactor,
    public activeModelId: string,
    readonly isResumed: boolean,
  ) {}

  static loadOrCreate(
    repo: ScenarioAgentConversationRepository,
    executionId: string,
    nodeId: string,
    initialModelId: string,
  ): DurableAgentContext {
    const existing = repo.find(executionId, nodeId);
    if (existing) {
      const compactor = new InMemoryCompactor(`${executionId}:${nodeId}`, {
        messages: existing.messages,
        segments: existing.segments,
        nextIndex: existing.nextIndex,
      });
      return new DurableAgentContext(
        repo,
        existing.id,
        compactor,
        existing.activeModelId,
        true,
      );
    }
    const id = repo.create(executionId, nodeId, initialModelId);
    return new DurableAgentContext(
      repo,
      id,
      new InMemoryCompactor(`${executionId}:${nodeId}`),
      initialModelId,
      false,
    );
  }

  appendUser(parts: ChatMessageContentPart[]): void {
    this.compactor.appendUser(parts);
    this.persistLast();
  }

  appendAssistant(parts: ChatMessageContentPart[]): void {
    this.compactor.appendAssistant(parts);
    this.persistLast();
  }

  private persistLast(): void {
    const messages = this.compactor.currentMessages;
    const last = messages[messages.length - 1];
    if (last) this.repo.appendMessage(this.conversationId, last);
  }

  async compactIfNeeded(
    system: string,
    budget: ContextBudget,
    opts: {
      providers: ProviderRegistry;
      listEnabledModels: () => EnabledModelInfo[];
      summarizerModelId: string;
      reason: ContextSegment["reason"];
    },
    force = false,
  ): Promise<void> {
    if (!force && !this.compactor.shouldCompact(system, budget)) return;
    const before = new Set(this.compactor.currentSegments.map((s) => s.id));
    const ok = await this.compactor.compact(opts);
    if (!ok) return;
    const segment = this.compactor.currentSegments.find(
      (s) => !before.has(s.id),
    );
    if (!segment) return;
    const compactedIds = this.compactor.currentMessages
      .filter((message) => message.compactedInto === segment.id)
      .map((message) => message.id);
    this.repo.persistCompaction(this.conversationId, segment, compactedIds);
  }

  switchModel(modelId: string): void {
    this.activeModelId = modelId;
    this.repo.setActiveModel(this.conversationId, modelId);
  }

  markCompleted(): void {
    this.repo.markCompleted(this.conversationId);
  }

  markFailed(): void {
    this.repo.delete(this.conversationId);
  }
}
