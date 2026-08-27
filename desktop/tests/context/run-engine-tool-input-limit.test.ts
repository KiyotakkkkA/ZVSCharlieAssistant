import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  stepCountIs: vi.fn(() => vi.fn()),
  streamText: vi.fn(() => ({
    stream: (async function* () {
      yield {
        type: "tool-input-start",
        id: "provider-call-1",
        toolName: "fs_write",
      };
      yield {
        type: "tool-input-delta",
        id: "provider-call-1",
        delta: '{"path":"C:/project/report.html","content":"long',
      };
      yield { type: "error", error: new Error("stream terminated") };
      yield {
        type: "finish",
        finishReason: "error",
        rawFinishReason: undefined,
        totalUsage: { inputTokens: 10, outputTokens: 2048 },
      };
    })(),
  })),
}));

import { streamText } from "ai";
import { RunEngine } from "../../src/host/infrastructure/text-generation/run-engine";
import type { RunEvent } from "../../src/shared/models/chat";

describe("RunEngine interruption inside tool input", () => {
  it("drains terminal finish, classifies the cut as output_limit and retries with staged tools", async () => {
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
        { skillCatalog: vi.fn(() => ""), cleanupRun: vi.fn() } as never,
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
        { mode: "chat", modelId: "model-1", text: "Создай отчёт" },
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
      content: expect.stringContaining("fs_write_begin"),
    });
    expect(data.addStep).toHaveBeenCalledWith(
      "run-1",
      0,
      expect.objectContaining({
        rawFinishReason: "incomplete_tool_input:fs_write",
      }),
      "length",
      expect.anything(),
    );
  });
});
