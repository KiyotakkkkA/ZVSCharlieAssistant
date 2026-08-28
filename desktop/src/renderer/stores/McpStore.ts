import { makeAutoObservable, runInAction } from "mobx";
import type { McpSnapshot } from "../../ipc/contracts";

let unsubscribe: (() => void) | null = null;

class McpStore {
  snapshot: McpSnapshot | null = null;
  loading = false;
  revalidating = false;
  error: string | null = null;
  initialized = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  startWatching(): void {
    if (unsubscribe) return;
    unsubscribe = window.desktop.mcp.subscribe((snapshot) => {
      runInAction(() => {
        this.snapshot = snapshot;
      });
    });
  }

  async bootstrap(force = false): Promise<void> {
    this.startWatching();
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    this.error = null;
    try {
      const snapshot = await window.desktop.mcp.getSnapshot();
      runInAction(() => {
        this.snapshot = snapshot;
        this.initialized = true;
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить состояние MCP";
      });
    } finally {
      runInAction(() => (this.loading = false));
    }
  }

  async revalidate(): Promise<void> {
    this.revalidating = true;
    try {
      const snapshot = await window.desktop.mcp.revalidate();
      runInAction(() => (this.snapshot = snapshot));
    } finally {
      runInAction(() => (this.revalidating = false));
    }
  }
}

export const mcpStore = new McpStore();
