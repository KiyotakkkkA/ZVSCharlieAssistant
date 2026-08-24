import { describe, expect, it, vi } from "vitest";
import { LocalBridgeServer } from "../../src/host/infrastructure/bridge/local-bridge.server";
import type { RunEvent } from "../../src/shared/models/chat";

describe("события локального CLI-моста", () => {
  it("одновременно отправляет run event в CLI и desktop chat", () => {
    const publishChatEvent = vi.fn();
    const write = vi.fn();
    const server = new LocalBridgeServer({
      publishChatEvent,
    } as unknown as ConstructorParameters<typeof LocalBridgeServer>[0]);
    const event: RunEvent = { type: "run.completed", runId: "run-1" };
    const internal = server as unknown as {
      sendRunEvent(
        session: { socket: { destroyed: boolean; write: typeof write } },
        requestId: number,
        event: RunEvent,
      ): void;
    };

    internal.sendRunEvent(
      { socket: { destroyed: false, write } },
      42,
      event,
    );

    expect(publishChatEvent).toHaveBeenCalledOnce();
    expect(publishChatEvent).toHaveBeenCalledWith(event);
    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(String(write.mock.calls[0]?.[0]).trim())).toEqual({
      id: 42,
      event: "run.completed",
      payload: event,
    });
  });
});
