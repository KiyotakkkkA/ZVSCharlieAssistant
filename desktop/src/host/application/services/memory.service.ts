import type { MemoryRepository } from "../../infrastructure/database/memory.repository";
import type {
  MemoryChangeEvent,
  MemoryEntry,
  MemoryKind,
  MemorySnapshot,
  MemorySource,
} from "../../../shared/models/memory";
import type {
  UpsertMemoryEntryInput,
  UpsertMemoryPolicyInput,
} from "../../../shared/dto";

export interface MemoryWriteContext {
  source: MemorySource;
  conversationId?: string | null;
  executionId?: string | null;
  agentId?: string | null;
  agentMayWrite?: boolean;
}

export class MemoryService {
  private listener?: (event: MemoryChangeEvent) => void;

  constructor(private readonly data: MemoryRepository) {}

  watch(listener: (event: MemoryChangeEvent) => void): void {
    this.listener = listener;
  }

  snapshot(): MemorySnapshot {
    return {
      policy: this.data.policy(),
      entries: this.data.list(),
      total: this.data.count(),
    };
  }

  policy() {
    return this.data.policy();
  }

  upsertPolicy(input: UpsertMemoryPolicyInput) {
    const policy = this.data.upsertPolicy(input);
    this.data.evictOverflow(policy.maxEntries);
    return this.snapshot();
  }

  contextBlock(options: { agentMayRead: boolean; query?: string }): string {
    const policy = this.data.policy();
    if (
      !policy.enabled ||
      !options.agentMayRead ||
      policy.injectedEntries === 0
    )
      return "";
    const entries = options.query?.trim()
      ? dedupe([
          ...this.data.search(options.query, policy.injectedEntries),
          ...this.data.contextEntries(policy.injectedEntries),
        ]).slice(0, policy.injectedEntries)
      : this.data.contextEntries(policy.injectedEntries);
    if (!entries.length) return "";
    const lines = entries.map(
      (entry) =>
        `- [${KIND_LABELS[entry.kind]}] ${entry.title}: ${entry.content}`,
    );
    return `\n\nПамять о пользователе и его задачах (используй, если релевантно; не пересказывай без нужды):\n${lines.join("\n")}`;
  }

  search(query: string, limit: number, agentMayRead: boolean): MemoryEntry[] {
    const policy = this.data.policy();
    if (!policy.enabled) throw new Error("Память отключена политикой");
    if (!agentMayRead) throw new Error("Агенту не разрешено чтение памяти");
    return this.data.search(query, Math.min(Math.max(limit, 1), 25));
  }

  save(
    input: {
      kind: MemoryKind;
      title: string;
      content: string;
      tags?: string[];
      pinned?: boolean;
    },
    context: MemoryWriteContext,
  ): MemoryEntry {
    const policy = this.data.policy();
    if (!policy.enabled) throw new Error("Память отключена политикой");
    if (context.source !== "manual" && !policy.autosave)
      throw new Error("Самостоятельная запись в память отключена политикой");
    if (context.source !== "manual" && context.agentMayWrite === false)
      throw new Error("Агенту не разрешена запись в память");
    if (context.source === "scenario" && !policy.allowScenarioWrites)
      throw new Error(
        "Запись в память из сценариев запрещена политикой. Включите её в «Настройки → Политики → Память».",
      );
    const content = input.content.trim();
    if (content.length > policy.maxContentChars)
      throw new Error(
        `Запись длиннее допустимых ${policy.maxContentChars} символов`,
      );
    const { entry, created } = this.data.upsert({
      kind: input.kind,
      title: input.title.trim(),
      content,
      tags: input.tags ?? [],
      source: context.source,
      conversationId: context.conversationId,
      executionId: context.executionId,
      agentId: context.agentId,
      pinned: input.pinned,
    });
    this.data.evictOverflow(policy.maxEntries);
    this.emit({
      action: created ? "created" : "updated",
      title: entry.title,
      kind: entry.kind,
      entryId: entry.id,
    });
    return entry;
  }

  upsertFromUi(input: UpsertMemoryEntryInput): MemorySnapshot {
    this.save(input, { source: "manual" });
    return this.snapshot();
  }

  setPinned(id: string, pinned: boolean): MemorySnapshot {
    this.data.setPinned(id, pinned);
    return this.snapshot();
  }

  remove(id: string): MemorySnapshot {
    const entry = this.data.find(id);
    this.data.remove(id);
    if (entry)
      this.emit({
        action: "removed",
        title: entry.title,
        kind: entry.kind,
        entryId: null,
      });
    return this.snapshot();
  }

  clear(): MemorySnapshot {
    const removed = this.data.clear();
    if (removed)
      this.emit({
        action: "removed",
        title: `Очищено записей: ${removed}`,
        kind: "fact",
        entryId: null,
      });
    return this.snapshot();
  }

  private emit(event: MemoryChangeEvent): void {
    try {
      this.listener?.(event);
    } catch {}
  }
}

const KIND_LABELS: Record<MemoryKind, string> = {
  fact: "факт",
  preference: "предпочтение",
  instruction: "указание",
  episode: "случай",
};

const dedupe = (entries: MemoryEntry[]): MemoryEntry[] => {
  const seen = new Set<string>();
  return entries.filter((entry) =>
    seen.has(entry.id) ? false : (seen.add(entry.id), true),
  );
};
