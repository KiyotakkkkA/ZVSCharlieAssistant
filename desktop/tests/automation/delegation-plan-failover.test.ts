import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const generateObjectMock = vi.fn();
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateObject: (...args: unknown[]) => generateObjectMock(...args),
  };
});

import { APICallError, NoObjectGeneratedError } from "ai";
import { HostScenarioEngineServices } from "../../src/host/infrastructure/automation/engine/host-services.adapter";
import {
  createAgentExecutor,
  createOrchestratorExecutor,
} from "../../src/host/infrastructure/automation/engine/executors";
import type {
  GenerateObjectRequest,
  ScenarioEngineServices,
} from "../../src/host/infrastructure/automation/engine/services";
import { graph, node, edge, resetIds } from "../support/graph-builder";
import { runGraph } from "../support/runtime-harness";

const PLAN_SCHEMA = z.object({ answer: z.string() });

interface ModelShape {
  id: string;
  contextLength: number;
  maxCompletionTokens: number;
  supportsStructuredOutput?: boolean;
}

function makeServices(models: ModelShape[]) {
  const providers = {
    resolve: (id: string) => ({ id }),
    modelInfo: (id: string) => {
      const model = models.find((entry) => entry.id === id);
      if (!model) throw new Error(`Неизвестная модель ${id}`);
      return {
        contextLength: model.contextLength,
        maxCompletionTokens: model.maxCompletionTokens,
        supportsStructuredOutput: model.supportsStructuredOutput,
      };
    },
    generationSettings: () => ({
      maxOutputTokens: 2_400,
      temperature: 0.7,
      topP: 0.9,
    }),
  };
  return new HostScenarioEngineServices(
    {} as never,
    providers as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    () => models.map((model) => ({ ...model, kind: "ollama" })) as never,
  );
}

function planRequest(
  modelId = "model-1",
): GenerateObjectRequest<{ answer: string }> {
  return {
    runId: "exec-1",
    nodeId: "node-1",
    modelId,
    system: "оркестратор",
    prompt: { objective: "тест" },
    signal: new AbortController().signal,
    schema: PLAN_SCHEMA,
  };
}

function apiError(statusCode: number): APICallError {
  return new APICallError({
    message: "провайдер недоступен",
    url: "https://example.test/v1",
    requestBodyValues: {},
    statusCode,
  });
}

function malformedJsonError(): NoObjectGeneratedError {
  return new NoObjectGeneratedError({
    message: "модель вернула не JSON",
    text: "{ answer: ",
    cause: new Error("невалидный JSON"),
    response: {
      id: "test-response",
      timestamp: new Date(0),
      modelId: "test-model",
    },
    usage: {
      inputTokens: 0,
      inputTokenDetails: {
        noCacheTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      outputTokens: 0,
      outputTokenDetails: {
        textTokens: 0,
        reasoningTokens: 0,
      },
      totalTokens: 0,
    },
    finishReason: "stop",
  });
}

const SINGLE_MODEL: ModelShape[] = [
  { id: "model-1", contextLength: 32_000, maxCompletionTokens: 2_400 },
];

describe("HostScenarioEngineServices.generateObject", () => {
  afterEach(() => {
    generateObjectMock.mockReset();
  });

  it("повторяет попытку при временном сбое вместо немедленного отказа", async () => {
    const services = makeServices(SINGLE_MODEL);
    generateObjectMock
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce({ object: { answer: "план" } });

    await expect(services.generateObject(planRequest())).resolves.toEqual({
      answer: "план",
    });
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
  });

  it("не считает битый JSON фатальной ошибкой с первой попытки", async () => {
    const services = makeServices(SINGLE_MODEL);
    generateObjectMock
      .mockRejectedValueOnce(malformedJsonError())
      .mockResolvedValueOnce({ object: { answer: "план" } });

    await expect(services.generateObject(planRequest())).resolves.toEqual({
      answer: "план",
    });
    expect(generateObjectMock).toHaveBeenCalledTimes(2);
  });

  it("переключается только на модель, умеющую отвечать по схеме", async () => {
    const services = makeServices([
      { id: "model-1", contextLength: 32_000, maxCompletionTokens: 2_400 },
      {
        id: "model-wide",
        contextLength: 128_000,
        maxCompletionTokens: 8_000,
        supportsStructuredOutput: false,
      },
      {
        id: "model-schema",
        contextLength: 64_000,
        maxCompletionTokens: 4_000,
        supportsStructuredOutput: true,
      },
    ]);
    generateObjectMock.mockImplementation(
      (options: { model: { id: string } }) =>
        options.model.id === "model-1"
          ? Promise.reject(apiError(429))
          : Promise.resolve({ object: { answer: "план" } }),
    );

    await expect(services.generateObject(planRequest())).resolves.toEqual({
      answer: "план",
    });
    const used = generateObjectMock.mock.calls.map(
      (call) => (call[0] as { model: { id: string } }).model.id,
    );
    expect(used[0]).toBe("model-1");
    expect(used[1]).toBe("model-schema");
    expect(used).not.toContain("model-wide");
  });

  it("исчерпав цепочку, сообщает о нехватке моделей и сохраняет причину", async () => {
    const services = makeServices(SINGLE_MODEL);
    const cause = apiError(401);
    generateObjectMock.mockRejectedValue(cause);

    await expect(services.generateObject(planRequest())).rejects.toMatchObject({
      message: expect.stringContaining("ответ строго по схеме"),
      cause,
    });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it("ограничивает ответ бюджетом активной модели", async () => {
    const services = makeServices(SINGLE_MODEL);
    generateObjectMock.mockResolvedValueOnce({ object: { answer: "план" } });

    await services.generateObject(planRequest());
    const options = generateObjectMock.mock.calls[0]?.[0] as {
      maxOutputTokens: number;
    };
    expect(options.maxOutputTokens).toBe(2_400);
  });
});

function orchestratorServices(
  overrides: Partial<ScenarioEngineServices>,
): ScenarioEngineServices {
  return {
    defaultModelId: () => "019cba09-8f30-7000-8000-000000000204",
    agent: (id: string) => ({
      id,
      name: id,
      description: "",
      instructions: "Инструкция",
      textModelId: "019cba09-8f30-7000-8000-000000000206",
      allowedToolIds: [],
      allowedVectorStoreIds: [],
      allowedSkillIds: [],
      retrievalLimit: 5,
      maxToolCalls: 5,
      timeoutSeconds: 60,
      terminalPolicy: "disabled",
      directoryPolicy: "disabled",
    }),
    generateText: async () => "результат исполнителя",
    generateObject: async () => ({}) as never,
    createTools: () => undefined,
    searchKnowledge: async () => [],
    httpFetch: (async () =>
      new Response("{}", { status: 200 })) as typeof fetch,
    secret: () => undefined,
    downloadFiles: async () => [],
    readFiles: async () => ({ documents: [], unsupportedFiles: [] }),
    effectOnce: async (_request, perform) => perform(),
    deliverResponse: () => undefined,
    runSubScenario: async () => null,
    askApproval: () => ({ answer: [] }),
    ...overrides,
  } as ScenarioEngineServices;
}

function runOrchestrator(options: {
  strictPlan: boolean;
  generateObject: ScenarioEngineServices["generateObject"];
}) {
  resetIds();
  const services = orchestratorServices({
    generateObject: options.generateObject,
  });
  const trigger = node("trigger.manual", { name: "Старт" });
  const orchestrator = node("orchestrator", {
    name: "Оркестратор",
    config: {
      mode: "llm",
      objective: "тест",
      strictPlan: options.strictPlan,
      synthesize: false,
    },
  });
  const worker = node("agent", {
    name: "Исполнитель",
    config: { agentId: "019cba09-8f30-7000-8000-000000000211" },
  });
  return {
    orchestrator,
    result: runGraph(
      graph(
        [trigger, orchestrator, worker],
        [
          edge(trigger, orchestrator),
          edge(orchestrator, worker, { from: "workers" }),
        ],
      ),
      {
        extraExecutors: [
          createOrchestratorExecutor(services),
          createAgentExecutor(services),
        ],
      },
    ),
  };
}

describe("оркестратор при сбое планирования", () => {
  it("помечает синтезированный план в диагностике узла", async () => {
    const { orchestrator, result } = runOrchestrator({
      strictPlan: false,
      generateObject: async () => {
        throw new Error("модель не смогла построить план");
      },
    });
    const run = await result;
    expect(run.status).toBe("completed");
    const completed = run.events.find(
      (event) =>
        event.type === "node.completed" && event.nodeId === orchestrator.id,
    );
    expect(completed?.diagnostics?.planSource).toBe("fallback");
    expect(String(completed?.diagnostics?.planError)).toContain(
      "не смогла построить",
    );
    expect(String(completed?.diagnostics?.planWarning)).toContain(
      "исходная задача",
    );
  });

  it("отмечает план как полученный от модели, когда планирование удалось", async () => {
    const { orchestrator, result } = runOrchestrator({
      strictPlan: false,
      generateObject: async () =>
        ({
          originalRequest: "тест",
          delegations: [
            {
              nodeId: "worker",
              agentId: "019cba09-8f30-7000-8000-000000000211",
              task: "часть задачи",
              context: "",
              expectedResult: "",
            },
          ],
          finalSynthesis: "",
        }) as never,
    });
    const run = await result;
    const completed = run.events.find(
      (event) =>
        event.type === "node.completed" && event.nodeId === orchestrator.id,
    );
    expect(completed?.diagnostics?.planSource).toBe("model");
    expect(completed?.diagnostics?.planError).toBeUndefined();
  });

  it("при strictPlan останавливает узел с ошибкой, как и раньше", async () => {
    const { result } = runOrchestrator({
      strictPlan: true,
      generateObject: async () => {
        throw new Error("модель не смогла построить план");
      },
    });
    await expect(result).rejects.toThrow(/план делегирования/i);
  });
});
