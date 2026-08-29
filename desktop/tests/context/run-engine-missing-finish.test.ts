import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  stepCountIs: vi.fn(() => vi.fn()),
  streamText: vi.fn(() => ({
    stream: (async function* () {
      yield {
        type: "reasoning-delta",
        text: "The report session is ready. Now add the first blocks.",
      };
      yield {
        type: "error",
        error: new Error("Response stream ended without a finish reason."),
      };
      yield {
        type: "finish",
        finishReason: "error",
        rawFinishReason: undefined,
        totalUsage: { inputTokens: 500, outputTokens: 2_048 },
      };
    })(),
  })),
}));

import { streamText } from "ai";
import { RunEngine } from "../../src/host/infrastructure/text-generation/run-engine";
import type { RunEvent } from "../../src/shared/models/chat";

describe("RunEngine stream without finish reason", () => {
  it("treats the provider protocol cutoff as recoverable and preserves an existing staged session", async () => {
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
      setRunStatus: vi.fn(),
      setMessageStatus: vi.fn(),
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
        contextLength: 32_768,
        maxCompletionTokens: 8_192,
        promptPricePerToken: 0,
        completionPricePerToken: 0,
      })),
      generationSettings: vi.fn(() => ({
        maxOutputTokens: 8_192,
        temperature: 0.7,
        topP: 0.9,
      })),
    };
    const terminalEvent = new Promise<RunEvent>((resolve) => {
      const engine = new RunEngine(
        data as never,
        providers as never,
        {
          skillCatalog: vi.fn(() => ""),
          selectedSkillBlock: vi.fn(() => ""),
          cleanupRun: vi.fn(),
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
        { mode: "chat", modelId: "model-1", text: "Продолжи отчёт" },
        (event) => {
          if (event.type === "run.failed") resolve(event);
        },
      );
    });

    await expect(terminalEvent).resolves.toMatchObject({
      type: "run.failed",
      message: expect.stringContaining("лимит ответа"),
    });
    expect(vi.mocked(streamText)).toHaveBeenCalledTimes(4);
    expect(vi.mocked(streamText).mock.calls[1]?.[0]?.messages).toContainEqual({
      role: "user",
      content: expect.stringMatching(/sessionId.*не создавай новую сессию/i),
    });
    expect(data.addStep).toHaveBeenCalledWith(
      "run-1",
      0,
      expect.objectContaining({
        rawFinishReason: "stream_ended_without_finish_reason",
      }),
      "length",
      expect.anything(),
    );
  });
});
