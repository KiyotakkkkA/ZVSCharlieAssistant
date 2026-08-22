import { makeAutoObservable, runInAction } from "mobx";
import type { EntityGenerationRun } from "../../ipc/contracts";
import { automationStore } from "./AutomationStore";
import {
  parseIpcDto,
  startEntityGenerationDtoSchema,
  type StartEntityGenerationInput,
} from "../../shared/dto";

const settled = new Set<string>();
let timer: number | null = null;

class EntityGenerationStore {
  runs: EntityGenerationRun[] = [];
  loading = false;
  starting = false;
  initialized = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get pendingCount() {
    return this.runs.filter(
      (run) => run.status === "queued" || run.status === "running",
    ).length;
  }

  async bootstrap(force = false) {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    this.error = null;
    try {
      const runs = await window.desktop.entityGeneration.list();
      const produced = runs.filter(
        (run) => run.status === "completed" && !settled.has(run.id),
      );
      const first = !this.initialized;
      runs.forEach((run) => {
        if (run.status !== "queued" && run.status !== "running")
          settled.add(run.id);
      });
      runInAction(() => {
        this.runs = runs;
        this.initialized = true;
      });
      if (!first && produced.length) await automationStore.bootstrap(true);
      if (this.pendingCount) this.watch();
      else this.unwatch();
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Не удалось загрузить историю генераций";
      });
    } finally {
      runInAction(() => (this.loading = false));
    }
  }

  async start(input: StartEntityGenerationInput) {
    this.starting = true;
    try {
      const run = await window.desktop.entityGeneration.start(
        parseIpcDto(startEntityGenerationDtoSchema, input),
      );
      runInAction(() => this.runs.unshift(run));
      this.watch();
      return run;
    } finally {
      runInAction(() => (this.starting = false));
    }
  }

  watch() {
    if (timer !== null) return;
    timer = window.setInterval(() => void this.bootstrap(true), 4000);
  }

  unwatch() {
    if (timer === null) return;
    window.clearInterval(timer);
    timer = null;
  }
}

export const entityGenerationStore = new EntityGenerationStore();
