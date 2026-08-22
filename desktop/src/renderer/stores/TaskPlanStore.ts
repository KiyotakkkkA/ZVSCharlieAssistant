import { makeAutoObservable, runInAction } from "mobx";
import type { TaskItemStatus, TaskPlan } from "../../ipc/contracts";

export class TaskPlanStore {
  plan: TaskPlan | null = null;
  conversationId: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get hasTasks() {
    return Boolean(this.plan?.items.length);
  }

  get progress() {
    const items = this.plan?.items ?? [];
    const done = items.filter(
      (item) => item.status === "completed" || item.status === "skipped",
    ).length;
    return { done, total: items.length };
  }

  async load(conversationId: string | null) {
    runInAction(() => (this.conversationId = conversationId));
    if (!conversationId) {
      runInAction(() => (this.plan = null));
      return;
    }
    const plan =
      await window.desktop.assistant.tasks.forConversation(conversationId);
    runInAction(() => {
      if (this.conversationId === conversationId) this.plan = plan;
    });
  }

  async setStatus(position: number, status: TaskItemStatus) {
    if (!this.conversationId) return;
    const plan = await window.desktop.assistant.tasks.setStatus(
      this.conversationId,
      position,
      status,
    );
    runInAction(() => (this.plan = plan));
  }

  async clear() {
    if (!this.conversationId) return;
    await window.desktop.assistant.tasks.clear(this.conversationId);
    runInAction(() => (this.plan = null));
  }
}

export const taskPlanStore = new TaskPlanStore();
