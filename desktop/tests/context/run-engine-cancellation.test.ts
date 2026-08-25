import { describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  stepCountIs: vi.fn(() => vi.fn()),
  streamText: vi.fn(() => ({
    stream: (async function* () {
      return;
    })(),
  })),
}));

import { RunEngine } from "../../src/host/infrastructure/text-generation/run-engine";
import type { RunEvent } from "../../src/shared/models/chat";

describe("отмена RunEngine", () => {
  it("не помечает отменённый до первой дельты запуск как completed", async () => {
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
      runUsage: vi.fn(() => undefined),
    };
    const providers = {
      resolve: vi.fn(() => ({})),
      modelInfo: vi.fn(() => ({
        contextLength: 8192,
        maxCompletionTokens: 2048,
        promptPricePerToken: 0,
        completionPricePerToken: 0,
      })),
      generationSettings: vi.fn(() => ({
        maxOutputTokens: 2048,
        temperature: 0.7,
        topP: 0.9,
      })),
    };
    const events: RunEvent[] = [];
    let terminal: (event: RunEvent) => void = () => undefined;
    const terminalEvent = new Promise<RunEvent>((resolve) => {
      terminal = resolve;
    });
    const engine = new RunEngine(
      data as never,
      providers as never,
      { skillCatalog: vi.fn(() => "") } as never,
      { contextBlock: vi.fn(() => "") } as never,
      { promptBlock: vi.fn(() => "") } as never,
      { shouldCompact: vi.fn(() => false) } as never,
      {} as never,
      {
        forConversation: vi.fn(() => undefined),
        promptBlock: vi.fn(() => ""),
      } as never,
    );

    const started = await engine.start(
      {
        mode: "chat",
        modelId: "model-1",
        text: "Привет",
      },
      (event) => {
        events.push(event);
        if (event.type === "run.cancelled" || event.type === "run.failed")
          terminal(event);
      },
    );
    engine.cancel(started.runId);

    await expect(terminalEvent).resolves.toMatchObject({
      type: "run.cancelled",
      runId: "run-1",
    });
    expect(runStatuses).toEqual(["running", "cancelled"]);
    expect(messageStatuses).toEqual(["cancelled"]);
    expect(events.some((event) => event.type === "run.completed")).toBe(false);
  });
});
