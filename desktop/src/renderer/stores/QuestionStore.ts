import { makeAutoObservable, runInAction } from "mobx";
import type { UserQuestion } from "../../ipc/contracts";
import { parseIpcDto, answerQuestionDtoSchema } from "../../shared/dto";

export class QuestionStore {
  pending: UserQuestion[] = [];
  conversationId: string | null = null;
  answering = false;

  private unsubscribe?: () => void;

  constructor() {
    makeAutoObservable<this, "unsubscribe">(
      this,
      { unsubscribe: false },
      { autoBind: true },
    );
  }

  get current(): UserQuestion | null {
    return this.pending[0] ?? null;
  }

  start() {
    this.unsubscribe?.();
    this.unsubscribe = window.desktop.assistant.questions.subscribe(
      (question) => {
        if (question.scope !== "chat") return;
        runInAction(() => {
          const rest = this.pending.filter((item) => item.id !== question.id);
          this.pending =
            question.status === "pending" ? [...rest, question] : rest;
        });
      },
    );
  }

  async load(conversationId: string | null) {
    runInAction(() => (this.conversationId = conversationId));
    if (!conversationId) {
      runInAction(() => (this.pending = []));
      return;
    }
    const pending =
      await window.desktop.assistant.questions.pendingForConversation(
        conversationId,
      );
    runInAction(() => {
      if (this.conversationId === conversationId) this.pending = pending;
    });
  }

  async answer(questionId: string, answer: string[]) {
    this.answering = true;
    try {
      await window.desktop.assistant.questions.answer(
        parseIpcDto(answerQuestionDtoSchema, { questionId, answer }),
      );
      runInAction(() => {
        this.pending = this.pending.filter((item) => item.id !== questionId);
      });
    } finally {
      runInAction(() => (this.answering = false));
    }
  }
}

export const questionStore = new QuestionStore();
