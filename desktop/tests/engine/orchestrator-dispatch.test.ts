import { describe, expect, it } from "vitest";
import { graph, node, edge, resetIds } from "../support/graph-builder";
import {
  MemoryPersistence,
  runGraph,
  spyExecutor,
} from "../support/runtime-harness";
import {
  createAgentExecutor,
  createOrchestratorExecutor,
} from "../../src/host/infrastructure/automation/engine/executors";
import type {
  GenerateTextRequest,
  ScenarioEngineServices,
} from "../../src/host/infrastructure/automation/engine/services";
import { ScenarioSuspended } from "../../src/shared/scenario/errors";

const AGENT_ALPHA = "019cba09-8f30-7000-8000-000000000211";
const AGENT_BETA = "019cba09-8f30-7000-8000-000000000212";
const AGENT_MODEL = "019cba09-8f30-7000-8000-000000000206";
const QUESTION_ID = "019cba09-8f30-7000-8000-000000000304";

function fakeServices(
  generateText: (request: GenerateTextRequest) => Promise<string>,
): ScenarioEngineServices {
  return {
    defaultModelId: () => "019cba09-8f30-7000-8000-000000000204",
    agent: (id: string) => ({
      id,
      name: id,
      description: "",
      instructions: "Инструкция",
      textModelId: id === AGENT_BETA ? AGENT_MODEL : null,
      allowedToolIds: [],
      allowedVectorStoreIds: [],
      allowedSkillIds: [],
      retrievalLimit: 5,
      maxToolCalls: 5,
      timeoutSeconds: 60,
      terminalPolicy: "disabled",
      directoryPolicy: "disabled",
    }),
    generateText,
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
  } as unknown as ScenarioEngineServices;
}

function fanOut(options: {
  workerRuntime?: Record<string, unknown>;
  betaRuntime?: Record<string, unknown>;
}) {
  resetIds();
  const trigger = node("trigger.manual", { name: "Старт" });
  const orchestrator = node("orchestrator", {
    name: "Оркестратор",
    config: { mode: "graph", objective: "общая задача" },
  });
  const alpha = node("agent", {
    name: "Альфа",
    config: { agentId: AGENT_ALPHA },
    runtime: options.workerRuntime ?? {},
  });
  const beta = node("agent", {
    name: "Бета",
    config: { agentId: AGENT_BETA },
    runtime: options.betaRuntime ?? {},
  });
  return {
    trigger,
    orchestrator,
    alpha,
    beta,
    built: graph(
      [trigger, orchestrator, alpha, beta],
      [
        edge(trigger, orchestrator),
        edge(orchestrator, alpha, { from: "workers" }),
        edge(orchestrator, beta, { from: "workers" }),
      ],
    ),
  };
}

function executorsFor(services: ScenarioEngineServices) {
  return [createOrchestratorExecutor(services), createAgentExecutor(services)];
}

describe("оркестратор раздаёт задачи через планировщик", () => {
  it("исполнители становятся собственными запусками узлов", async () => {
    const requests: GenerateTextRequest[] = [];
    const services = fakeServices(async (request) => {
      requests.push(request);
      return `ответ ${request.nodeId}`;
    });
    const { orchestrator, alpha, beta, built } = fanOut({});

    const result = await runGraph(built, {
      extraExecutors: executorsFor(services),
    });

    expect(result.status).toBe("completed");
    expect(result.persistence.countFor(alpha.id)).toBe(1);
    expect(result.persistence.countFor(beta.id)).toBe(1);

    const runIds = result.persistence.runs.map((run) => run.nodeRunId);
    expect(new Set(runIds).size).toBe(runIds.length);
    const orchestratorRun = result.persistence.runs.find(
      (run) => run.nodeId === orchestrator.id,
    );
    for (const request of requests)
      expect(request.nodeRunId).not.toBe(orchestratorRun?.nodeRunId);

    expect(requests.map((request) => request.nodeId).sort()).toEqual(
      [alpha.id, beta.id].sort(),
    );
  });

  it("каждый исполнитель получает своё поручение и модель оркестратора", async () => {
    const prompts = new Map<string, unknown>();
    const models = new Map<string, string>();
    const services = fakeServices(async (request) => {
      prompts.set(request.nodeId, request.prompt);
      models.set(request.nodeId, request.modelId);
      return "готово";
    });
    const { alpha, beta, built } = fanOut({});

    await runGraph(built, { extraExecutors: executorsFor(services) });

    const alphaPrompt = prompts.get(alpha.id) as {
      task: { task: string; originalRequest: string };
    };
    expect(alphaPrompt.task.task).toContain("общая задача");
    expect(alphaPrompt.task.originalRequest).toBe("общая задача");
    expect(models.get(alpha.id)).toBe("019cba09-8f30-7000-8000-000000000204");
    expect(models.get(beta.id)).toBe(AGENT_MODEL);
  });

  it("исполнитель повторяет попытку по своей политике retry", async () => {
    let alphaAttempts = 0;
    const { alpha, beta, built } = fanOut({
      workerRuntime: {
        retry: { maxTries: 3, backoffMs: 1, backoffFactor: 1 },
      },
    });
    const services = fakeServices(async (request) => {
      if (request.nodeId !== alpha.id) return "готово";
      alphaAttempts += 1;
      if (alphaAttempts < 3)
        throw Object.assign(new Error("временный сбой исполнителя"), {
          code: "ECONNRESET",
        });
      return "готово с третьей попытки";
    });

    const result = await runGraph(built, {
      extraExecutors: executorsFor(services),
    });

    expect(result.status).toBe("completed");
    expect(alphaAttempts).toBe(3);
    expect(result.persistence.statusesFor(alpha.id)).toEqual([
      "failed",
      "failed",
      "completed",
    ]);
    expect(result.persistence.countFor(beta.id)).toBe(1);
  });

  it("падение одного исполнителя не отменяет остальных", async () => {
    resetIds();
    const trigger = node("trigger.manual", { name: "Старт" });
    const orchestrator = node("orchestrator", {
      name: "Оркестратор",
      config: { mode: "graph", objective: "общая задача" },
    });
    const alpha = node("agent", {
      name: "Альфа",
      config: { agentId: AGENT_ALPHA },
      runtime: { retry: { maxTries: 1 } },
    });
    const beta = node("agent", {
      name: "Бета",
      config: { agentId: AGENT_BETA },
    });
    const collector = node("noop", { name: "Сбор" });
    const built = graph(
      [trigger, orchestrator, alpha, beta, collector],
      [
        edge(trigger, orchestrator),
        edge(orchestrator, alpha, { from: "workers" }),
        edge(orchestrator, beta, { from: "workers" }),
        edge(alpha, collector),
      ],
    );
    const services = fakeServices(async (request) => {
      if (request.nodeId === alpha.id)
        throw new Error("исполнитель не справился");
      return "ответ Беты";
    });
    const collected: Array<{ json: unknown; error?: { message: string } }> = [];

    const result = await runGraph(built, {
      extraExecutors: [
        ...executorsFor(services),
        spyExecutor("noop", ({ items }) => {
          collected.push(...(items as typeof collected));
          return items;
        }),
      ],
    });

    expect(result.status).toBe("completed");
    expect(result.persistence.statusesFor(alpha.id)).toEqual(["failed"]);
    expect(result.persistence.statusesFor(beta.id)).toEqual(["completed"]);

    const failed = result.events.find(
      (event) => event.type === "node.failed" && event.nodeId === alpha.id,
    );
    expect(failed?.error).toContain("не справился");

    expect(collected.length).toBeGreaterThan(0);
    for (const item of collected)
      expect(item.error?.message).toContain("не справился");
    expect(
      collected.some(
        (item) => (item.json as { nodeId: string }).nodeId === alpha.id,
      ),
    ).toBe(true);
  });

  it("исполнитель может приостановить сценарий и продолжить с себя", async () => {
    let answered = false;
    const { alpha, beta, built } = fanOut({});
    const services = fakeServices(async (request) => {
      if (request.nodeId === alpha.id && !answered)
        throw new ScenarioSuspended(QUESTION_ID, alpha.id);
      return `ответ ${request.nodeId}`;
    });
    const persistence = new MemoryPersistence();

    const first = await runGraph(built, {
      extraExecutors: executorsFor(services),
      persistence,
    });

    expect(first.status).toBe("suspended");
    expect(first.suspension).toEqual({
      nodeId: alpha.id,
      questionId: QUESTION_ID,
    });
    expect(persistence.statusesFor(alpha.id)).toEqual(["waiting_for_approval"]);

    answered = true;
    const second = await runGraph(built, {
      extraExecutors: executorsFor(services),
      checkpoint: first.checkpoint,
      persistence,
    });

    expect(second.status).toBe("completed");
    expect(persistence.statusesFor(alpha.id)).toEqual([
      "waiting_for_approval",
      "completed",
    ]);
    expect(persistence.countFor(beta.id)).toBe(1);
  });
});
