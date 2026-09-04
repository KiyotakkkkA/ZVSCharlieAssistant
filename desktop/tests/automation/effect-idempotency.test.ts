import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { edge, graph, node, resetIds } from "../support/graph-builder";
import { runGraph } from "../support/runtime-harness";
import {
  createDownloadFilesExecutor,
  createHttpExecutor,
} from "../../src/host/infrastructure/automation/engine/executors";
import type { ScenarioEngineServices } from "../../src/host/infrastructure/automation/engine/services";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ScenarioEffectRepository } from "../../src/host/infrastructure/database/scenario-effect.repository";
import { effectKey } from "../../src/host/infrastructure/automation/effect-key";
import { TelegramDeliveryAdapter } from "../../src/host/infrastructure/automation/delivery/telegram-delivery.adapter";
import type { ScenarioDeliveryJob } from "../../src/host/infrastructure/database/scenario-delivery.repository";

let database: Database.Database | undefined;

function setupEffects(): {
  effects: ScenarioEffectRepository;
  db: Database.Database;
} {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  database = db;
  return { effects: new ScenarioEffectRepository(db), db };
}

function servicesWith(
  effects: ScenarioEffectRepository,
  overrides: Partial<ScenarioEngineServices> = {},
): ScenarioEngineServices {
  return {
    defaultModelId: () => null,
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
    effectOnce: async (request, perform) => {
      const key = effectKey(request);
      const recorded = effects.find(key);
      if (recorded) return recorded.result as never;
      const result = await perform();
      effects.record({
        idempotencyKey: key,
        executionId: request.executionId,
        nodeId: request.nodeId,
        kind: request.kind,
        result,
      });
      return result;
    },
    deliverResponse: () => undefined,
    runSubScenario: async () => null,
    askApproval: () => ({ answer: [] }),
    ...overrides,
  };
}

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("идемпотентность эффектов", () => {
  it("повторный запуск узла http не отправляет запрос второй раз", async () => {
    const { effects } = setupEffects();
    let calls = 0;
    const services = servicesWith(effects, {
      httpFetch: (async () => {
        calls += 1;
        return new Response(JSON.stringify({ n: calls }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as typeof fetch,
    });

    const build = () => {
      resetIds();
      const trigger = node("trigger.manual", { name: "Старт" });
      const http = node("http", {
        name: "Запрос",
        config: {
          method: "POST",
          url: "https://example.com/api",
          bodyMode: "json",
          body: { a: 1 },
          parseJson: true,
        },
      });
      return {
        built: graph([trigger, http], [edge(trigger, http)]),
        httpId: http.id,
      };
    };

    const first = build();
    const firstRun = await runGraph(first.built, {
      extraExecutors: [createHttpExecutor(services)],
    });
    expect(firstRun.status).toBe("completed");
    expect(calls).toBe(1);

    const second = build();
    expect(second.httpId).toBe(first.httpId);
    const secondRun = await runGraph(second.built, {
      extraExecutors: [createHttpExecutor(services)],
    });

    expect(secondRun.status).toBe("completed");
    expect(calls).toBe(1);
    expect(secondRun.outputs["Запрос"]).toEqual(firstRun.outputs["Запрос"]);
  });

  it("повторный запуск узла downloadFiles не скачивает файлы второй раз", async () => {
    const { effects } = setupEffects();
    let calls = 0;
    const services = servicesWith(effects, {
      downloadFiles: async () => {
        calls += 1;
        return [
          {
            id: "file-1",
            fileName: "отчёт.pdf",
            mimeType: "application/pdf",
            size: 10,
            sha256: "a".repeat(64),
            storageKey: "key-1",
          },
        ];
      },
    });

    const build = () => {
      resetIds();
      const trigger = node("trigger.manual", { name: "Старт" });
      const download = node("downloadFiles", {
        name: "Скачать",
        config: {
          source: "urls",
          urls: ["https://example.com/f.pdf"],
          maxFiles: 5,
        },
      });
      return graph([trigger, download], [edge(trigger, download)]);
    };

    await runGraph(build(), {
      extraExecutors: [createDownloadFilesExecutor(services)],
    });
    expect(calls).toBe(1);

    await runGraph(build(), {
      extraExecutors: [createDownloadFilesExecutor(services)],
    });
    expect(calls).toBe(1);
  });

  it("повторная доставка задания в Telegram отправляет сообщение один раз", async () => {
    const { effects } = setupEffects();
    const sent: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown) => {
      const url = String(input);
      if (url.includes("sendMessage")) sent.push(url);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    try {
      const adapter = new TelegramDeliveryAdapter(
        {
          findProfile: () => ({
            kind: "telegram_bot",
            enabled: true,
            status: "connected",
            secretBindings: { botToken: "secret-1" },
          }),
        } as never,
        { findSecret: () => ({ content: "token-1" }) } as never,
        { readBinary: async () => Buffer.alloc(0) } as never,
        effects,
      );

      const job: ScenarioDeliveryJob = {
        id: "outbox-1",
        executionId: "exec-1",
        nodeRunId: "node-run-1",
        channel: "telegram",
        integrationProfileId: "profile-1",
        recipient: "chat-1",
        payload: { text: "привет" },
        attempt: 1,
        maxAttempts: 3,
      };

      await adapter.deliver(job);
      expect(sent).toHaveLength(1);

      await adapter.deliver({ ...job, nodeRunId: "node-run-2", attempt: 2 });
      expect(sent).toHaveLength(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
