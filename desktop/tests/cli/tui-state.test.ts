import { describe, expect, it } from "vitest";
import type { UserQuestion } from "../../src/shared/models/user-question";
import { initialTuiState, reduceTuiState } from "../../src/cli/tui/state";

const question = {
  id: "question-1",
  header: "Выбор",
  question: "Продолжить?",
  options: [{ label: "Да" }, { label: "Нет" }],
} as UserQuestion;

describe("TUI state machine", () => {
  it("сохраняет реальный порядок reasoning, tools и answer", () => {
    let state = reduceTuiState(initialTuiState(), {
      type: "run.started",
      id: "run-1",
      message: "Исправь тест",
    });
    state = reduceTuiState(state, {
      type: "reasoning.delta",
      delta: "Сначала ",
    });
    state = reduceTuiState(state, {
      type: "reasoning.delta",
      delta: "проверю",
    });
    state = reduceTuiState(state, {
      type: "tool.changed",
      tool: {
        callId: "tool-1",
        toolId: "fs_edit",
        status: "requested",
        summary: "fs_edit · запрошен",
      },
    });
    state = reduceTuiState(state, {
      type: "tool.changed",
      tool: {
        callId: "tool-1",
        toolId: "fs_edit",
        status: "completed",
        summary: "fs_edit · файл изменён",
      },
    });
    state = reduceTuiState(state, {
      type: "reasoning.delta",
      delta: "Теперь перечитаю",
    });
    state = reduceTuiState(state, {
      type: "tool.changed",
      tool: {
        callId: "tool-2",
        toolId: "fs_read",
        status: "completed",
        summary: "fs_read · готово",
      },
    });
    state = reduceTuiState(state, {
      type: "reasoning.delta",
      delta: "Всё корректно",
    });
    state = reduceTuiState(state, { type: "answer.delta", delta: "Готово" });
    state = reduceTuiState(state, { type: "run.completed", id: "run-1" });

    expect(state.phase).toBe("completed");
    expect(state.transcript.map((item) => item.kind)).toEqual([
      "user",
      "reasoning",
      "tool",
      "reasoning",
      "tool",
      "reasoning",
      "assistant",
    ]);
    expect(state.transcript[1]?.text).toBe("Сначала проверю");
    expect(state.transcript[2]?.text).toBe("fs_edit · файл изменён");
  });

  it("переключает фокус на вопрос и сохраняет follow-up в очередь", () => {
    let state = reduceTuiState(initialTuiState(), {
      type: "run.started",
      id: "run-1",
      message: "Начинай",
    });
    state = reduceTuiState(state, {
      type: "draft.changed",
      value: "следом тесты",
    });
    state = reduceTuiState(state, {
      type: "message.queued",
      value: state.draft,
    });
    state = reduceTuiState(state, { type: "question.requested", question });

    expect(state.queued).toEqual(["следом тесты"]);
    expect(state.phase).toBe("waiting-user");
    expect(state.question?.id).toBe("question-1");

    state = reduceTuiState(state, { type: "question.answered" });
    expect(state.phase).toBe("running");
    expect(state.question).toBeUndefined();

    state = reduceTuiState(state, { type: "queue.shifted" });
    expect(state.queued).toEqual([]);
  });
});
