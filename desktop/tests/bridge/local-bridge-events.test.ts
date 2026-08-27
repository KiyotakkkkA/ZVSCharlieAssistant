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

    internal.sendRunEvent({ socket: { destroyed: false, write } }, 42, event);

    expect(publishChatEvent).toHaveBeenCalledOnce();
    expect(publishChatEvent).toHaveBeenCalledWith(event);
    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(String(write.mock.calls[0]?.[0]).trim())).toEqual({
      id: 42,
      event: "run.completed",
      payload: event,
    });
  });

  it("передаёт вопросы и ответы между CLI и сервисом", async () => {
    const conversationId = "0198f4b8-7b1a-7000-8000-000000000001";
    const questionId = "0198f4b8-7b1a-7000-8000-000000000002";
    const pendingForConversation = vi.fn(() => [{ id: questionId }]);
    const answer = vi.fn(() => ({ id: questionId, status: "answered" }));
    const server = new LocalBridgeServer({
      questions: { pendingForConversation, answer },
    } as unknown as ConstructorParameters<typeof LocalBridgeServer>[0]);
    const internal = server as unknown as {
      handle(session: unknown, request: unknown): Promise<unknown>;
    };

    await expect(
      internal.handle(
        {},
        {
          id: 1,
          method: "questions.pending",
          params: { conversationId },
        },
      ),
    ).resolves.toEqual([{ id: questionId }]);
    await expect(
      internal.handle(
        {},
        {
          id: 2,
          method: "questions.answer",
          params: { questionId, answer: ["Продолжить"] },
        },
      ),
    ).resolves.toEqual({ id: questionId, status: "answered" });

    expect(pendingForConversation).toHaveBeenCalledWith(conversationId);
    expect(answer).toHaveBeenCalledWith(questionId, ["Продолжить"], "ui");
  });
});
