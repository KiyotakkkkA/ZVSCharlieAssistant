import { afterEach, describe, expect, it, vi } from "vitest";

const streamTextMock = vi.fn();
vi.mock("ai", () => ({
  stepCountIs: vi.fn(() => vi.fn()),
  streamText: (...args: unknown[]) => streamTextMock(...args),
}));

import { runStepWithRetry } from "../../src/host/application/context/agentic-step-loop";

function streamOf(parts: Array<Record<string, unknown>>) {
  return {
    stream: (async function* () {
      for (const part of parts) yield part;
    })(),
  };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    providers: {
      resolve: vi.fn(() => ({})),
      generationSettings: vi.fn(() => ({
        maxOutputTokens: 2_400,
        temperature: 0.7,
        topP: 0.9,
      })),
    },
    failover: { decide: vi.fn() },
    activeModelId: "model-1",
    system: "system prompt",
    maxOutputTokens: 2_400,
    abortSignal: new AbortController().signal,
    budgetFor: vi.fn(() => ({
      contextLength: 32_768,
      maxOutput: 2_400,
      usable: 20_000,
      compactAt: 15_000,
      hardStop: 19_000,
      estimated: false,
    })),
    buildMessages: vi.fn(() => [{ role: "user" as const, content: "hi" }]),
    compact: vi.fn(async () => undefined),
    ...overrides,
  } as never;
}

describe("runStepWithRetry", () => {
  afterEach(() => {
    streamTextMock.mockReset();
  });

  it("returns accumulated text for a clean step", async () => {
    streamTextMock.mockReturnValueOnce(
      streamOf([{ type: "text-delta", text: "Готово" }]),
    );
    const result = await runStepWithRetry(baseInput());
    expect(result.text).toBe("Готово");
    expect(result.hasToolCalls).toBe(false);
    expect(result.activeModelId).toBe("model-1");
  });

  it("classifies tool calls and results", async () => {
    streamTextMock.mockReturnValueOnce(
      streamOf([
        { type: "tool-call", toolCallId: "c1", toolName: "t", input: {} },
        {
          type: "tool-result",
          toolCallId: "c1",
          toolName: "t",
          output: { ok: true },
        },
      ]),
    );
    const result = await runStepWithRetry(baseInput());
    expect(result.hasToolCalls).toBe(true);
    expect(result.toolCallParts).toHaveLength(1);
    expect(result.resultParts).toHaveLength(1);
  });

  it("retries the same step after a delay on a 'retry' decision", async () => {
    const decide = vi
      .fn()
      .mockReturnValueOnce({ kind: "retry", delayMs: 0 })
      .mockReturnValueOnce(undefined);
    streamTextMock
      .mockImplementationOnce(() => {
        throw new Error("transient");
      })
      .mockReturnValueOnce(streamOf([{ type: "text-delta", text: "ok" }]));
    const result = await runStepWithRetry(baseInput({ failover: { decide } }));
    expect(result.text).toBe("ok");
    expect(streamTextMock).toHaveBeenCalledTimes(2);
    expect(decide).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ attempt: 0, compacted: false }),
    );
  });

  it("forces compaction on the next attempt after a 'compact' decision", async () => {
    const decide = vi.fn().mockReturnValueOnce({ kind: "compact" });
    const compact = vi.fn(async () => undefined);
    streamTextMock
      .mockImplementationOnce(() => {
        throw new Error("context overflow");
      })
      .mockReturnValueOnce(streamOf([{ type: "text-delta", text: "ok" }]));
    await runStepWithRetry(baseInput({ failover: { decide }, compact }));
    expect(compact).toHaveBeenCalledTimes(2);
    expect(compact.mock.calls[0]?.[0]).toBe(false);
    expect(compact.mock.calls[1]?.[0]).toBe(true);
  });

  it("switches the active model on a 'switch' decision and reports it via onModelSwitch", async () => {
    const decide = vi.fn().mockReturnValueOnce({
      kind: "switch",
      modelId: "model-2",
      reason: "provider_error",
      detail: "500",
    });
    streamTextMock
      .mockImplementationOnce(() => {
        throw new Error("provider down");
      })
      .mockReturnValueOnce(streamOf([{ type: "text-delta", text: "ok" }]));
    const onModelSwitch = vi.fn();
    const result = await runStepWithRetry(
      baseInput({ failover: { decide }, onModelSwitch }),
    );
    expect(result.activeModelId).toBe("model-2");
    expect(onModelSwitch).toHaveBeenCalledWith(
      "model-2",
      "provider_error",
      "500",
      undefined,
    );
  });

  it("rethrows and calls onFail on a 'fail' decision, without retrying", async () => {
    const decide = vi.fn().mockReturnValueOnce({ kind: "fail" });
    const originalError = new Error("fatal");
    streamTextMock.mockImplementationOnce(() => {
      throw originalError;
    });
    const onFail = vi.fn();
    await expect(
      runStepWithRetry(baseInput({ failover: { decide }, onFail })),
    ).rejects.toThrow("fatal");
    expect(onFail).toHaveBeenCalledWith(originalError);
    expect(streamTextMock).toHaveBeenCalledTimes(1);
  });
  it("собирает finishReason и сырой usage из терминального finish", async () => {
    streamTextMock.mockReturnValueOnce(
      streamOf([
        { type: "text-delta", text: "часть" },
        {
          type: "finish",
          finishReason: "length",
          rawFinishReason: "max_tokens",
          totalUsage: { inputTokens: 10, outputTokens: 20 },
        },
      ]),
    );
    const onStepComplete = vi.fn();
    const result = await runStepWithRetry(baseInput({ onStepComplete }));
    expect(result.finishReason).toBe("length");
    expect(result.rawFinishReason).toBe("max_tokens");
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 });
    expect(onStepComplete).toHaveBeenCalledTimes(1);
  });

  it("без recoverStreamError бросает ошибку потока и уходит в failover", async () => {
    const decide = vi.fn().mockReturnValueOnce({ kind: "fail" });
    streamTextMock.mockReturnValueOnce(
      streamOf([{ type: "error", error: new Error("stream terminated") }]),
    );
    await expect(
      runStepWithRetry(baseInput({ failover: { decide } })),
    ).rejects.toThrow("stream terminated");
    expect(decide).toHaveBeenCalledTimes(1);
  });

  it("дочитывает поток после ошибки и переклассифицирует обрыв через recoverStreamError", async () => {
    streamTextMock.mockReturnValueOnce(
      streamOf([
        { type: "tool-input-start", id: "call-1", toolName: "fs_write" },
        { type: "tool-input-delta", id: "call-1", delta: '{"path":"a"' },
        { type: "error", error: new Error("stream terminated") },
        {
          type: "finish",
          finishReason: "error",
          totalUsage: { inputTokens: 1, outputTokens: 2 },
        },
      ]),
    );
    const decide = vi.fn();
    const onStepComplete = vi.fn();
    const result = await runStepWithRetry(
      baseInput({
        failover: { decide },
        onStepComplete,
        recoverStreamError: (
          _error: Error,
          step: { interruptedToolInput?: { toolName: string } },
        ) =>
          step.interruptedToolInput
            ? {
                finishReason: "length",
                rawFinishReason: `incomplete_tool_input:${step.interruptedToolInput.toolName}`,
              }
            : undefined,
      }),
    );
    expect(decide).not.toHaveBeenCalled();
    expect(result.interruptedToolInput).toEqual({
      toolName: "fs_write",
      receivedBytes: 11,
    });
    expect(result.finishReason).toBe("length");
    expect(result.rawFinishReason).toBe("incomplete_tool_input:fs_write");
    expect(result.usage).toEqual({ inputTokens: 1, outputTokens: 2 });
    expect(onStepComplete).toHaveBeenCalledTimes(1);
  });

  it("бросает ошибку потока, если recoverStreamError счёл обрыв невосстановимым", async () => {
    const decide = vi.fn().mockReturnValueOnce({ kind: "fail" });
    streamTextMock.mockReturnValueOnce(
      streamOf([
        { type: "error", error: new Error("boom") },
        { type: "finish", finishReason: "error" },
      ]),
    );
    const onStepComplete = vi.fn();
    await expect(
      runStepWithRetry(
        baseInput({
          failover: { decide },
          onStepComplete,
          recoverStreamError: () => undefined,
        }),
      ),
    ).rejects.toThrow("boom");
    expect(onStepComplete).toHaveBeenCalledTimes(1);
  });

  it("не обращается к провайдеру, если сигнал уже прерван", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runStepWithRetry(baseInput({ abortSignal: controller.signal })),
    ).rejects.toThrow();
    expect(streamTextMock).not.toHaveBeenCalled();
  });
});
