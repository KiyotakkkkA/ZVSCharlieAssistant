import { afterEach, describe, expect, it, vi } from "vitest";
import type { CliOptions } from "../../src/cli/args";
import type { BridgeClient } from "../../src/cli/client";
import { runChat } from "../../src/cli/render";
import type { RunEvent } from "../../src/shared/models/chat";

const options: CliOptions = {
  command: "chat",
  prompt: "Привет",
  model: "model-1",
  projectDirectory: false,
  permissionMode: "edit",
  output: "json",
  positional: [],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("отмена генерации из CLI", () => {
  it("не отправляет chat.cancel при обычном run.started", async () => {
    const methods: string[] = [];
    const client = fakeClient(async (method, _params, onEvent) => {
      methods.push(method);
      if (method !== "chat.start") throw new Error(`unexpected ${method}`);
      emit(onEvent, {
        type: "run.started",
        runId: "run-1",
      } as unknown as RunEvent);
      emit(onEvent, { type: "run.completed", runId: "run-1" });
      return { runId: "run-1", conversationId: "conversation-1" };
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await expect(runChat(client, options)).resolves.toBe(0);
    expect(methods).toEqual(["chat.start"]);
  });

  it("откладывает Ctrl+C до получения runId и отменяет ровно один раз", async () => {
    const methods: string[] = [];
    const client = fakeClient(async (method, _params, onEvent) => {
      methods.push(method);
      if (method === "chat.cancel") return { ok: true };
      if (method !== "chat.start") throw new Error(`unexpected ${method}`);

      const signalHandler = process.listeners("SIGINT").at(-1);
      if (!signalHandler) throw new Error("SIGINT handler is missing");
      signalHandler("SIGINT");
      emit(onEvent, {
        type: "run.started",
        runId: "run-2",
      } as unknown as RunEvent);
      emit(onEvent, { type: "run.cancelled", runId: "run-2" });
      return { runId: "run-2", conversationId: "conversation-2" };
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await expect(runChat(client, options)).resolves.toBe(1);
    expect(methods).toEqual(["chat.start", "chat.cancel"]);
  });
});

function fakeClient(
  request: (
    method: string,
    params?: unknown,
    onEvent?: (event: string, payload: unknown) => void,
  ) => Promise<unknown>,
): BridgeClient {
  return { request } as unknown as BridgeClient;
}

function emit(
  listener: ((event: string, payload: unknown) => void) | undefined,
  event: RunEvent,
) {
  listener?.(event.type, event);
}
