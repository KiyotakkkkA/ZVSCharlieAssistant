import { makeAutoObservable, runInAction } from "mobx";
import type {
  MemoryChangeEvent,
  MemoryEntry,
  MemoryPolicy,
  MemorySnapshot,
} from "../../ipc/contracts";
import {
  parseIpcDto,
  upsertMemoryEntryDtoSchema,
  upsertMemoryPolicyDtoSchema,
  type UpsertMemoryEntryInput,
  type UpsertMemoryPolicyInput,
} from "../../shared/dto";

export class MemoryStore {
  policy: MemoryPolicy | null = null;
  entries: MemoryEntry[] = [];
  total = 0;
  loading = false;
  saving = false;
  initialized = false;
  lastChange: MemoryChangeEvent | null = null;

  private unsubscribe?: () => void;

  constructor() {
    makeAutoObservable<this, "unsubscribe">(
      this,
      { unsubscribe: false },
      { autoBind: true },
    );
  }

  async bootstrap(force = false) {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    try {
      const snapshot = await window.desktop.assistant.memory.getSnapshot();
      this.apply(snapshot);
      runInAction(() => (this.initialized = true));
      this.unsubscribe?.();
      this.unsubscribe = window.desktop.assistant.memory.subscribe((event) => {
        runInAction(() => (this.lastChange = event));
        void this.refresh();
      });
    } finally {
      runInAction(() => (this.loading = false));
    }
  }

  acknowledgeChange() {
    this.lastChange = null;
  }

  async refresh() {
    const snapshot = await window.desktop.assistant.memory.getSnapshot();
    this.apply(snapshot);
  }

  async savePolicy(input: UpsertMemoryPolicyInput) {
    this.saving = true;
    try {
      this.apply(
        await window.desktop.assistant.memory.upsertPolicy(
          parseIpcDto(upsertMemoryPolicyDtoSchema, input),
        ),
      );
    } finally {
      runInAction(() => (this.saving = false));
    }
  }

  async upsertEntry(input: UpsertMemoryEntryInput) {
    this.apply(
      await window.desktop.assistant.memory.upsertEntry(
        parseIpcDto(upsertMemoryEntryDtoSchema, input),
      ),
    );
  }

  async setPinned(id: string, pinned: boolean) {
    this.apply(await window.desktop.assistant.memory.setPinned(id, pinned));
  }

  async remove(id: string) {
    this.apply(await window.desktop.assistant.memory.remove(id));
  }

  async clear() {
    this.apply(await window.desktop.assistant.memory.clear());
  }

  private apply(snapshot: MemorySnapshot) {
    runInAction(() => {
      this.policy = snapshot.policy;
      this.entries = snapshot.entries;
      this.total = snapshot.total;
    });
  }
}

export const memoryStore = new MemoryStore();
