import { describe, expect, it, vi } from "vitest";
import { UserQuestionService } from "../../src/host/application/services/user-question.service";
import type { UserQuestion } from "../../src/shared/models/user-question";

const createQuestion = (): UserQuestion => ({
  id: "question-1",
  scope: "chat",
  conversationId: "conversation-1",
  runId: "run-1",
  executionId: null,
  nodeId: null,
  nodeRunId: null,
  mode: "text",
  header: "Уточнение",
  question: "Как продолжить?",
  options: [],
  multiSelect: false,
  defaultAnswer: null,
  status: "pending",
  answer: null,
  answeredVia: null,
  answeredBy: null,
  channel: "ui",
  recipient: null,
  correlationId: null,
  expectedAuthor: null,
  expiresAt: null,
  createdAt: new Date().toISOString(),
  answeredAt: null,
});

function createService() {
  let question = createQuestion();
  const data = {
    create: vi.fn(() => question),
    close: vi.fn((_id: string, status: "timed_out" | "cancelled") => {
      question = { ...question, status };
    }),
    find: vi.fn(() => question),
    answer: vi.fn((_id: string, answer: string[]) => {
      question = {
        ...question,
        status: "answered",
        answer,
        answeredVia: "ui",
      };
      return question;
    }),
  };
  const service = new UserQuestionService(
    data as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, data };
}

describe("UserQuestionService: вопросы в чате", () => {
  it("снимает ожидание вопроса при отмене run", async () => {
    const { service, data } = createService();
    const controller = new AbortController();
    const pending = service.askInChat(
      {
        mode: "text",
        header: "Уточнение",
        question: "Как продолжить?",
        options: [],
        multiSelect: false,
      },
      { conversationId: "conversation-1", runId: "run-1" },
      controller.signal,
    );

    controller.abort();

    await expect(pending).rejects.toThrow("Выполнение отменено");
    expect(data.close).toHaveBeenCalledWith("question-1", "cancelled");
  });

  it("возвращает ответ ожидающему инструменту", async () => {
    const { service } = createService();
    const pending = service.askInChat(
      {
        mode: "text",
        header: "Уточнение",
        question: "Как продолжить?",
        options: [],
        multiSelect: false,
      },
      { conversationId: "conversation-1", runId: "run-1" },
    );

    service.answer("question-1", ["Продолжить"], "ui");

    await expect(pending).resolves.toEqual(["Продолжить"]);
  });
});
