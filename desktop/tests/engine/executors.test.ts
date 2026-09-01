import { describe, it, expect, vi } from "vitest";
import { graph, node, edge, resetIds } from "../support/graph-builder";
import { runGraph } from "../support/runtime-harness";
import {
  createAgentExecutor,
  createApprovalExecutor,
  createClassifyExecutor,
  createDownloadFilesExecutor,
  createHttpExecutor,
  createKnowledgeStoreExecutor,
  createOrchestratorExecutor,
  createOutputExecutor,
  createReadFilesExecutor,
  createSubScenarioExecutor,
} from "../../src/host/infrastructure/automation/engine/executors";
import type { ScenarioEngineServices } from "../../src/host/infrastructure/automation/engine/services";
import { ScenarioSuspended } from "../../src/shared/scenario/errors";

function fakeServices(
  overrides: Partial<ScenarioEngineServices> = {},
): ScenarioEngineServices {
  return {
    defaultModelId: () => "019cba09-8f30-7000-8000-000000000204",
    agent: () => undefined,
    generateText: async () => "",
    generateObject: async () => ({}) as never,
    createTools: () => undefined,
    searchKnowledge: async () => [],
    httpFetch: (async () =>
      new Response("{}", { status: 200 })) as typeof fetch,
    secret: () => undefined,
    downloadFiles: async () => [],
    readFiles: async () => ({ documents: [], unsupportedFiles: [] }),
    deliverResponse: () => undefined,
    runSubScenario: async () => null,
    askApproval: () => ({ answer: [] }),
    ...overrides,
  };
}

describe("узел output", () => {
  it("формирует текст ответа и передаёт items дальше без изменений", async () => {
    resetIds();
    const delivered: unknown[] = [];
    const services = fakeServices({
      deliverResponse: (input) => void delivered.push(input),
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const output = node("output", {
      name: "Итог",
      config: { text: "{{ $json.text }}", channels: [] },
    });
    const result = await runGraph(
      graph([trigger, output], [edge(trigger, output)]),
      {
        input: { text: "привет" },
        extraExecutors: [createOutputExecutor(services)],
      },
    );
    expect(result.status).toBe("completed");
    expect(delivered.length).toBe(1);
    expect((delivered[0] as { output: string }).output).toBe("привет");
  });
});

describe("узел http", () => {
  it("подставляет заголовок авторизации из секрета и парсит JSON-ответ", async () => {
    resetIds();
    let capturedHeaders: Headers | undefined;
    const services = fakeServices({
      secret: (id) =>
        id === "019cba09-8f30-7000-8000-000000000207"
          ? "top-secret"
          : undefined,
      httpFetch: (async (_url, init) => {
        capturedHeaders = init?.headers as Headers;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch,
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const http = node("http", {
      name: "Запрос",
      config: {
        method: "GET",
        url: "https://example.com/api",
        authSecretId: "019cba09-8f30-7000-8000-000000000207",
        authScheme: "bearer",
        timeoutSeconds: 30,
      },
    });
    const result = await runGraph(
      graph([trigger, http], [edge(trigger, http)]),
      {
        extraExecutors: [createHttpExecutor(services)],
      },
    );
    expect(result.status).toBe("completed");
    expect(capturedHeaders?.get("Authorization")).toBe("Bearer top-secret");
    const httpOutput = result.outputs["Запрос"] as
      | { json: unknown }
      | undefined;
    expect(httpOutput).toBeTruthy();
  });

  it("бросает повторяемую ошибку на HTTP 500 и ретраит", async () => {
    resetIds();
    let calls = 0;
    const services = fakeServices({
      httpFetch: (async () => {
        calls += 1;
        return calls < 2
          ? new Response("boom", { status: 500 })
          : new Response("{}", { status: 200 });
      }) as typeof fetch,
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const http = node("http", {
      name: "Запрос",
      config: { method: "GET", url: "https://example.com" },
      runtime: {
        retry: { maxTries: 3, backoffMs: 0, backoffFactor: 1, maxBackoffMs: 0 },
      },
    });
    const result = await runGraph(
      graph([trigger, http], [edge(trigger, http)]),
      {
        extraExecutors: [createHttpExecutor(services)],
      },
    );
    expect(result.status).toBe("completed");
    expect(calls).toBe(2);
  });
});

describe("узел approval", () => {
  it("приостанавливает ран, если сервис бросил ScenarioSuspended", async () => {
    resetIds();
    const services = fakeServices({
      askApproval: () => {
        throw new ScenarioSuspended("019cba09-8f30-7000-8000-000000000205");
      },
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const approval = node("approval", { name: "Вопрос" });
    const result = await runGraph(
      graph([trigger, approval], [edge(trigger, approval)]),
      {
        extraExecutors: [createApprovalExecutor(services)],
      },
    );
    expect(result.status).toBe("suspended");
    expect(result.suspension?.questionId).toBe(
      "019cba09-8f30-7000-8000-000000000205",
    );
  });

  it("режим confirm с ответом «Нет» уводит items на выход rejected", async () => {
    resetIds();
    const services = fakeServices({ askApproval: () => ({ answer: ["Нет"] }) });
    const trigger = node("trigger.manual", { name: "Старт" });
    const approval = node("approval", {
      name: "Вопрос",
      config: { mode: "confirm" },
    });
    const passthrough = node("noop", { name: "После отказа" });
    const result = await runGraph(
      graph(
        [trigger, approval, passthrough],
        [
          edge(trigger, approval),
          edge(approval, passthrough, { from: "rejected" }),
        ],
      ),
      { extraExecutors: [createApprovalExecutor(services)] },
    );
    expect(result.status).toBe("completed");
    expect(result.persistence.countFor(passthrough.id)).toBe(1);
  });
});

describe("узел subScenario", () => {
  it("передаёт вход и получает результат вложенного сценария", async () => {
    resetIds();
    const services = fakeServices({
      runSubScenario: async (input) => {
        expect(input.scenarioId).toBe("019cba09-8f30-7000-8000-000000000208");
        return { done: true };
      },
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const sub = node("subScenario", {
      name: "Вложенный",
      config: {
        scenarioId: "019cba09-8f30-7000-8000-000000000208",
        mode: "await",
      },
    });
    const result = await runGraph(graph([trigger, sub], [edge(trigger, sub)]), {
      extraExecutors: [createSubScenarioExecutor(services)],
    });
    expect(result.status).toBe("completed");
    const subOutput = result.outputs["Вложенный"] as {
      json: { done: boolean };
    };
    expect(subOutput.json.done).toBe(true);
  });
});

describe("узел knowledgeStore + agent", () => {
  it("агент получает найденные фрагменты на входе knowledge", async () => {
    resetIds();
    let seenKnowledge: unknown;
    const services = fakeServices({
      agent: (id) =>
        id === "019cba09-8f30-7000-8000-000000000209"
          ? {
              id: "019cba09-8f30-7000-8000-000000000209",
              name: "Ассистент",
              description: "",
              instructions: "Отвечай кратко.",
              textModelId: "019cba09-8f30-7000-8000-000000000206",
              allowedToolIds: [],
              allowedVectorStoreIds: [],
              allowedSkillIds: [],
              retrievalLimit: 5,
              maxToolCalls: 5,
              timeoutSeconds: 60,
              terminalPolicy: "disabled" as never,
              directoryPolicy: "disabled" as never,
            }
          : undefined,
      searchKnowledge: async () => [
        {
          documentId: "019cba09-8f30-7000-8000-000000000011",
          chunkIndex: 0,
          fileName: "doc.txt",
          content: "факт",
          score: 0.9,
          pageNumber: null,
        },
      ],
      generateText: async (request) => {
        seenKnowledge = (request.prompt as { knowledge: unknown }).knowledge;
        return "ответ";
      },
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const store = node("knowledgeStore", {
      name: "База",
      config: {
        vectorStoreId: "019cba09-8f30-7000-8000-000000000010",
        limit: 5,
        minScore: 0,
      },
    });
    const agentNode = node("agent", {
      name: "Агент",
      config: { agentId: "019cba09-8f30-7000-8000-000000000209" },
    });
    const result = await runGraph(
      graph(
        [trigger, store, agentNode],
        [
          edge(trigger, agentNode),
          edge(store, agentNode, { from: "knowledge", to: "knowledge" }),
        ],
      ),
      {
        extraExecutors: [
          createKnowledgeStoreExecutor(services),
          createAgentExecutor(services),
        ],
      },
    );
    expect(result.status).toBe("completed");
    expect(Array.isArray(seenKnowledge) && seenKnowledge.length).toBe(1);
    const agentOutput = result.outputs["Агент"] as { json: { text: string } };
    expect(agentOutput.json.text).toBe("ответ");
  });

  it("падает permanent-ошибкой, если агент не найден", async () => {
    resetIds();
    const services = fakeServices({ agent: () => undefined });
    const trigger = node("trigger.manual", { name: "Старт" });
    const agentNode = node("agent", {
      name: "Агент",
      config: { agentId: "019cba09-8f30-7000-8000-000000000210" },
    });
    const result = runGraph(
      graph([trigger, agentNode], [edge(trigger, agentNode)]),
      {
        extraExecutors: [createAgentExecutor(services)],
      },
    );
    await expect(result).rejects.toThrow(/агент не найден/);
  });
});

describe("узел classify", () => {
  it("направляет item в порт категории, которую вернула модель", async () => {
    resetIds();
    const services = fakeServices({
      generateObject: async () => ({ labels: ["Жалоба"] }) as never,
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const classify = node("classify", {
      name: "Классификатор",
      config: {
        categories: [
          { label: "Жалоба", description: "" },
          { label: "Вопрос", description: "" },
        ],
      },
    });
    const complaintBranch = node("noop", { name: "Ветка жалоб" });
    const result = await runGraph(
      graph(
        [trigger, classify, complaintBranch],
        [
          edge(trigger, classify),
          edge(classify, complaintBranch, { from: "out0" }),
        ],
      ),
      { extraExecutors: [createClassifyExecutor(services)] },
    );
    expect(result.status).toBe("completed");
    expect(result.persistence.countFor(complaintBranch.id)).toBe(1);
  });

  it("использует fallback, если вызов модели упал, а fallbackOutput включён", async () => {
    resetIds();
    const services = fakeServices({
      generateObject: async () => {
        throw new Error("модель недоступна");
      },
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const classify = node("classify", {
      name: "Классификатор",
      config: {
        categories: [{ label: "A", description: "" }],
        fallbackOutput: true,
      },
    });
    const fallbackBranch = node("noop", { name: "Иначе" });
    const result = await runGraph(
      graph(
        [trigger, classify, fallbackBranch],
        [
          edge(trigger, classify),
          edge(classify, fallbackBranch, { from: "fallback" }),
        ],
      ),
      { extraExecutors: [createClassifyExecutor(services)] },
    );
    expect(result.status).toBe("completed");
    expect(result.persistence.countFor(fallbackBranch.id)).toBe(1);
  });
});

describe("узел downloadFiles + readFiles", () => {
  it("скачанные файлы прокидываются как binary и распознаются readFiles", async () => {
    resetIds();
    const downloadFiles = vi.fn(async () => [
      {
        id: "019cba09-8f30-7000-8000-000000000020",
        fileName: "a.txt",
        mimeType: "text/plain",
        size: 3,
        sha256: "x",
        storageKey: "k",
      },
    ]);
    const services = fakeServices({
      downloadFiles,
      readFiles: async ({ files }) => ({
        documents: files.map((file) => ({
          fileId: file.id,
          fileName: file.fileName,
          mimeType: file.mimeType,
          text: "text",
          truncated: false,
        })),
        unsupportedFiles: [],
      }),
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const download = node("downloadFiles", { name: "Скачать" });
    const read = node("readFiles", { name: "Прочитать" });
    const result = await runGraph(
      graph(
        [trigger, download, read],
        [edge(trigger, download), edge(download, read)],
      ),
      {
        extraExecutors: [
          createDownloadFilesExecutor(services),
          createReadFilesExecutor(services),
        ],
      },
    );
    expect(result.status).toBe("completed");
    const readOutput = result.outputs["Прочитать"] as {
      json: { text: string };
    };
    expect(readOutput.json.text).toBe("text");
    expect(downloadFiles).toHaveBeenCalledWith(
      expect.objectContaining({ cleanupOnFinish: true }),
    );
  });
});

describe("узел orchestrator", () => {
  it("режим graph раздаёт одинаковую задачу всем подключённым исполнителям и синтезирует ответ", async () => {
    resetIds();
    const calls: string[] = [];
    const services = fakeServices({
      agent: (id) => ({
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
        terminalPolicy: "disabled" as never,
        directoryPolicy: "disabled" as never,
      }),
      generateText: async (request) => {
        calls.push(request.nodeId);
        return `результат ${request.nodeId}`;
      },
    });
    const trigger = node("trigger.manual", { name: "Старт" });
    const orchestrator = node("orchestrator", {
      name: "Оркестратор",
      config: { mode: "graph", objective: "тест" },
    });
    const worker = node("agent", {
      name: "Исполнитель",
      config: { agentId: "019cba09-8f30-7000-8000-000000000211" },
    });
    const result = await runGraph(
      graph(
        [trigger, orchestrator, worker],
        [
          edge(trigger, orchestrator),
          edge(orchestrator, worker, { from: "workers" }),
        ],
      ),
      { extraExecutors: [createOrchestratorExecutor(services)] },
    );
    expect(result.status).toBe("completed");
    expect(calls.length > 0).toBe(true);
    expect(result.persistence.countFor(worker.id)).toBe(0);
    const output = result.outputs["Оркестратор"] as { json: { text: string } };
    expect(output.json.text.includes("результат")).toBe(true);
  });
});
