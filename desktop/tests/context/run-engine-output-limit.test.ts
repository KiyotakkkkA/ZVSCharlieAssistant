import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  stepCountIs: vi.fn(() => vi.fn()),
  streamText: vi.fn(() => ({
    stream: (async function* () {
      yield { type: "text-delta", text: "часть ответа" };
      yield {
        type: "finish",
        finishReason: "length",
        rawFinishReason: "max_tokens",
        totalUsage: { inputTokens: 10, outputTokens: 20 },
      };
    })(),
  })),
}));

import { streamText } from "ai";
import { RunEngine } from "../../src/host/infrastructure/text-generation/run-engine";
import type { RunEvent } from "../../src/shared/models/chat";

describe("восстановление RunEngine после лимита вывода", () => {
  it("после исчерпания продолжений завершает запуск ошибкой, а не успехом", async () => {
    const runStatuses: string[] = [];
    const messageStatuses: string[] = [];
    const data = {
      createConversation: vi.fn(() => "conversation-1"),
      updateLastUsage: vi.fn(),
      createRun: vi.fn(() => "run-1"),
      addMessage: vi.fn(
        (_conversationId, _runId, role: "user" | "assistant") => ({
          id: `${role}-message`,
          role,
          status: role === "user" ? "completed" : "streaming",
          content: [],
        }),
      ),
      updateTitle: vi.fn(),
      setRunStatus: vi.fn((_id, status: string) => runStatuses.push(status)),
      setMessageStatus: vi.fn((_id, status: string) =>
        messageStatuses.push(status),
      ),
      journalMessages: vi.fn(() => []),
      contextSegments: vi.fn(() => []),
      writeMessageParts: vi.fn(),
      addStep: vi.fn(),
      addRunUsage: vi.fn(),
      runUsage: vi.fn(() => undefined),
    };
    const providers = {
      resolve: vi.fn(() => ({})),
      modelInfo: vi.fn(() => ({
        contextLength: 8192,
        maxCompletionTokens: 256,
        promptPricePerToken: 0,
        completionPricePerToken: 0,
      })),
      generationSettings: vi.fn(() => ({
        maxOutputTokens: 256,
        temperature: 0.7,
        topP: 0.9,
      })),
    };
    const events: RunEvent[] = [];
    const terminalEvent = new Promise<RunEvent>((resolve) => {
      const engine = new RunEngine(
        data as never,
        providers as never,
        {
          skillCatalog: vi.fn(() => ""),
          selectedSkillBlock: vi.fn(() => ""),
        } as never,
        { contextBlock: vi.fn(() => "") } as never,
        { promptBlock: vi.fn(() => "") } as never,
        { shouldCompact: vi.fn(() => false) } as never,
        {
          decide: vi.fn(() => ({ kind: "fail" })),
          widerOutputModel: vi.fn(() => undefined),
          widerContextModel: vi.fn(() => undefined),
          record: vi.fn(),
        } as never,
        {
          forConversation: vi.fn(() => undefined),
          promptBlock: vi.fn(() => ""),
        } as never,
      );

      void engine.start(
        { mode: "chat", modelId: "model-1", text: "Длинный ответ" },
        (event) => {
          events.push(event);
          if (event.type === "run.failed") resolve(event);
        },
      );
    });

    await expect(terminalEvent).resolves.toMatchObject({
      type: "run.failed",
      runId: "run-1",
      message: expect.stringContaining("лимит ответа"),
    });
    expect(vi.mocked(streamText)).toHaveBeenCalledTimes(4);
    expect(vi.mocked(streamText).mock.calls[1]?.[0]?.messages).toContainEqual({
      role: "user",
      content: expect.stringContaining("Продолжи предыдущий ответ"),
    });
    expect(runStatuses).toEqual(["running", "failed"]);
    expect(messageStatuses).toEqual(["failed"]);
    expect(events.some((event) => event.type === "run.completed")).toBe(false);
  });
});
