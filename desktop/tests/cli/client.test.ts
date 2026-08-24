import { describe, expect, it, vi } from "vitest";
import { BridgeClient } from "../../src/cli/client";
import { encodeFrame } from "../../src/shared/bridge/protocol";

describe("стриминг локального моста", () => {
  it("сохраняет подписку после ответа chat.start до терминального события", async () => {
    const client = new BridgeClient("unused");
    const onEvent = vi.fn();
    let resolveResponse: (value: unknown) => void = () => undefined;
    const response = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    const internal = client as unknown as {
      pending: Map<number, unknown>;
      receive(chunk: string): void;
    };
    internal.pending.set(7, {
      resolve: resolveResponse,
      reject: vi.fn(),
      onEvent,
      responseResolved: false,
      terminalSeen: false,
    });

    internal.receive(
      encodeFrame({ id: 7, ok: true, result: { runId: "run-1" } }),
    );
    await expect(response).resolves.toEqual({ runId: "run-1" });
    expect(internal.pending.has(7)).toBe(true);

    internal.receive(
      encodeFrame({
        id: 7,
        event: "reasoning.delta",
        payload: { type: "reasoning.delta", delta: "думаю" },
      }) +
        encodeFrame({
          id: 7,
          event: "tool.running",
          payload: { type: "tool.running", toolId: "fs_read" },
        }) +
        encodeFrame({
          id: 7,
          event: "run.completed",
          payload: { type: "run.completed", runId: "run-1" },
        }),
    );

    expect(onEvent).toHaveBeenCalledTimes(3);
    expect(internal.pending.has(7)).toBe(false);
  });
});
