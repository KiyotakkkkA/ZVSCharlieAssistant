import { makeAutoObservable, runInAction } from "mobx";
import type { EntityGenerationRun } from "../../ipc/contracts";
import { automationStore } from "./AutomationStore";
import {
  parseIpcDto,
  startEntityGenerationDtoSchema,
  answerQuestionDtoSchema,
  type StartEntityGenerationInput,
} from "../../shared/dto";

const settled = new Set<string>();
let timer: number | null = null;
let unsubscribeEvents: (() => void) | null = null;

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
      (run) =>
        run.status === "queued" ||
        run.status === "running" ||
        run.status === "clarification_requested",
    ).length;
  }

  startEventStream() {
    if (unsubscribeEvents) return;
    unsubscribeEvents = window.desktop.entityGeneration.subscribeRunEvents(
      (event) => {
        if (event.type !== "run.updated") return;
        const wasSettled = settled.has(event.run.id);
        if (event.run.status !== "queued" && event.run.status !== "running")
          settled.add(event.run.id);
        runInAction(() => {
          const index = this.runs.findIndex(
            (item) => item.id === event.run.id,
          );
          if (index >= 0) this.runs[index] = event.run;
          else this.runs.unshift(event.run);
        });
        if (event.run.status === "completed" && !wasSettled)
          void automationStore.bootstrap(true);
      },
    );
  }

  async bootstrap(force = false) {
    this.startEventStream();
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

  async answerQuestion(questionId: string, answer: string[]) {
    await window.desktop.assistant.questions.answer(
      parseIpcDto(answerQuestionDtoSchema, { questionId, answer }),
    );
    await this.bootstrap(true);
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
