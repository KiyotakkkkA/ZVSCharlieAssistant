import { describe, expect, it, vi } from "vitest";

const streamTextMock = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    stepCountIs: vi.fn(() => vi.fn()),
    streamText: (...args: unknown[]) => streamTextMock(...args),
  };
});

import { EntityGenerationService } from "../../src/host/application/services/entity-generation.service";
import type { EntityGenerationRun } from "../../src/shared/models/entity-generation";

function streamOf(parts: Array<Record<string, unknown>>) {
  return {
    stream: (async function* () {
      for (const part of parts) yield part;
    })(),
  };
}

function makeServices() {
  let run: EntityGenerationRun = {
    id: "run-1",
    kind: "agent",
    modelId: "model-1",
    prompt: "Создай агента-помощника",
    status: "queued",
    entityId: null,
    entityName: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    pendingQuestion: null,
  };

  const runs = {
    list: vi.fn(() => [run]),
    create: vi.fn(() => run),
    markRunning: vi.fn(() => {
      run = { ...run, status: "running" };
    }),
    markCompleted: vi.fn(
      (_id: string, entityId: string, entityName: string) => {
        run = { ...run, status: "completed", entityId, entityName };
      },
    ),
    markFailed: vi.fn((_id: string, error: string) => {
      run = { ...run, status: "failed", error };
    }),
    find: vi.fn(() => run),
  };

  const automation = {
    listSkills: vi.fn(() => []),
    upsertAgent: vi.fn((input: { name: string }) => ({
      id: "agent-1",
      name: input.name,
    })),
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
      maxOutputTokens: 2_400,
      temperature: 0.7,
      topP: 0.9,
    })),
  };

  const service = new EntityGenerationService(
    runs as never,
    automation as never,
    providers as never,
    [],
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    () => [],
  );

  return { service, runs };
}

describe("EntityGenerationService.execute (shared step loop)", () => {
  it("keeps calling the model each step and fails cleanly once the save tool is never invoked", async () => {
    streamTextMock.mockReturnValue(
      streamOf([{ type: "text-delta", text: "Думаю..." }]),
    );

    const { service, runs } = makeServices();
    service.start({
      kind: "agent",
      modelId: "model-1",
      prompt: "Создай агента-помощника",
    });

    await vi.waitFor(() => expect(runs.markFailed).toHaveBeenCalled());

    expect(runs.markFailed).toHaveBeenCalledWith(
      "run-1",
      expect.stringContaining("не вызвала инструмент сохранения"),
    );
    expect(runs.markCompleted).not.toHaveBeenCalled();
    expect(streamTextMock).toHaveBeenCalledTimes(16);
  });
});
