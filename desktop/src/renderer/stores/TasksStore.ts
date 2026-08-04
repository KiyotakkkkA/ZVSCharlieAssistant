import { makeAutoObservable, runInAction } from "mobx";
import type { AgentTaskRun } from "../../ipc/contracts";

class TasksStore {
  agentRuns: AgentTaskRun[] = [];
  loading = false;
  initialized = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap(force = false): Promise<void> {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    this.error = null;
    try {
      const agentRuns = await window.desktop.tasks.listAgentRuns();
      runInAction(() => {
        this.agentRuns = agentRuns;
        this.initialized = true;
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить историю запусков";
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }
}

export const tasksStore = new TasksStore();
