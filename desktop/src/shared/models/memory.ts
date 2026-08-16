export type MemoryKind = "fact" | "preference" | "instruction" | "episode";
export type MemorySource = "chat" | "scenario" | "manual";

export interface MemoryEntry {
  id: number;
  kind: MemoryKind;
  title: string;
  content: string;
  tags: string[];
  source: MemorySource;
  conversationId: number | null;
  executionId: number | null;
  agentId: string | null;
  pinned: boolean;
  hits: number;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryPolicy {
  enabled: boolean;
  autosave: boolean;
  allowScenarioWrites: boolean;
  maxEntries: number;
  maxContentChars: number;
  injectedEntries: number;
  updatedAt: string;
}

export interface MemorySnapshot {
  policy: MemoryPolicy;
  entries: MemoryEntry[];
  total: number;
}

export interface MemoryChangeEvent {
  action: "created" | "updated" | "removed";
  title: string;
  kind: MemoryKind;
  entryId: number | null;
}
