import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";

const streamTextMock = vi.fn();
vi.mock("ai", () => ({
  stepCountIs: vi.fn(() => vi.fn()),
  streamText: (...args: unknown[]) => streamTextMock(...args),
  generateObject: vi.fn(),
}));

import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ScenarioExecutionRepository } from "../../src/host/infrastructure/database/scenario-execution.repository";
import { ScenarioAgentConversationRepository } from "../../src/host/infrastructure/database/scenario-agent-conversation.repository";
import { HostScenarioEngineServices } from "../../src/host/infrastructure/automation/engine/host-services.adapter";
import type { GenerateTextRequest } from "../../src/host/infrastructure/automation/engine/services";

function streamOf(parts: Array<Record<string, unknown>>) {
  return {
    stream: (async function* () {
      for (const part of parts) yield part;
    })(),
  };
}

function setupDatabase(): Database.Database {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  runMigrations(database);
  database
    .prepare(`INSERT INTO automation_scenarios(id,name) VALUES(?,?)`)
    .run("scenario-1", "Тестовый сценарий");
  database
    .prepare(
      `INSERT INTO automation_scenario_revisions(id,scenario_id,version,graph_json)
       VALUES(?,?,?,?)`,
    )
    .run("revision-1", "scenario-1", 1, "{}");
  database
    .prepare(
      `INSERT INTO execution_runs(id,kind,origin,scenario_id,scenario_revision_id,status,input_json)
       VALUES(?,?,?,?,?,?,?)`,
    )
    .run(
      "exec-1",
      "scenario",
      "background",
      "scenario-1",
      "revision-1",
      "running",
      "{}",
    );
  database
    .prepare(
      `INSERT INTO scenario_node_runs(id,execution_id,node_id,node_kind,iteration,attempt,status,input_json)
       VALUES(?,?,?,?,?,?,?,?)`,
    )
    .run("node-run-1", "exec-1", "node-1", "agent", 0, 1, "running", "{}");
  database
    .prepare(
      `INSERT INTO text_provider_configs(id,kind,name,base_url,enabled,checked_at,generation_settings_json)
       VALUES(?,?,?,?,?,?,?)`,
    )
    .run(
      "provider-1",
      "ollama",
      "Test",
      "http://localhost:11434",
      1,
      new Date().toISOString(),
      "{}",
    );
  database
    .prepare(
      `INSERT INTO text_provider_models(id,provider_id,remote_id,name,enabled,details_json)
       VALUES(?,?,?,?,?,?)`,
    )
    .run("model-1", "provider-1", "model-1", "Model 1", 1, "{}");
  return database;
}

function makeServices(database: Database.Database) {
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
  const services = new HostScenarioEngineServices(
    new ScenarioExecutionRepository(database),
    providers as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    new ScenarioAgentConversationRepository(database),
    () => [],
  );
  return { services, providers };
}

function baseRequest(
  overrides: Partial<GenerateTextRequest> = {},
): GenerateTextRequest {
  return {
    runId: "exec-1",
    nodeId: "node-1",
    nodeRunId: "node-run-1",
    modelId: "model-1",
    system: "system prompt",
    prompt: { task: "сделай что-нибудь" },
    signal: new AbortController().signal,
    maxOutputTokens: 2_400,
    tools: { some_tool: {} } as never,
    ...overrides,
  };
}

describe("HostScenarioEngineServices.generateText", () => {
  afterEach(() => {
    streamTextMock.mockReset();
  });

  it("stops offering tools once maxToolCalls is exhausted and still returns final text", async () => {
    const database = setupDatabase();
    const { services } = makeServices(database);

    streamTextMock
      .mockReturnValueOnce(
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "some_tool",
            input: {},
          },
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "some_tool",
            output: { ok: true },
          },
        ]),
      )
      .mockReturnValueOnce(
        streamOf([
          {
            type: "tool-call",
            toolCallId: "call-2",
            toolName: "some_tool",
            input: {},
          },
          {
            type: "tool-result",
            toolCallId: "call-2",
            toolName: "some_tool",
            output: { ok: true },
          },
        ]),
      )
      .mockReturnValueOnce(streamOf([{ type: "text-delta", text: "Готово" }]));

    const text = await services.generateText(baseRequest({ maxToolCalls: 2 }));

    expect(text).toBe("Готово");
    expect(streamTextMock).toHaveBeenCalledTimes(3);
    expect(streamTextMock.mock.calls[2]?.[0]?.tools).toBeUndefined();
    expect(streamTextMock.mock.calls[0]?.[0]?.tools).toBeDefined();
    expect(streamTextMock.mock.calls[1]?.[0]?.tools).toBeDefined();

    database.close();
  });

  it("resumes a crashed conversation from its last persisted step instead of restarting", async () => {
    const database = setupDatabase();
    const { services, providers } = makeServices(database);

    streamTextMock.mockReturnValueOnce(
      streamOf([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "some_tool",
          input: {},
        },
        {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "some_tool",
          output: { ok: true },
        },
      ]),
    );
    providers.modelInfo
      .mockImplementationOnce(() => ({
        contextLength: 32_768,
        maxCompletionTokens: 8_192,
        promptPricePerToken: 0,
        completionPricePerToken: 0,
      }))
      .mockImplementationOnce(() => {
        throw new Error("process crashed");
      });

    await expect(services.generateText(baseRequest())).rejects.toThrow(
      "process crashed",
    );

    const conversation = database
      .prepare(
        `SELECT status FROM scenario_agent_conversations WHERE execution_id=? AND node_id=?`,
      )
      .get("exec-1", "node-1") as { status: string } | undefined;
    expect(conversation?.status).toBe("active");

    streamTextMock.mockReset();
    streamTextMock.mockReturnValueOnce(
      streamOf([{ type: "text-delta", text: "Готово после восстановления" }]),
    );

    const text = await services.generateText(baseRequest());
    expect(text).toBe("Готово после восстановления");

    const messages = streamTextMock.mock.calls[0]?.[0]?.messages as Array<{
      role: string;
    }>;
    expect(messages.some((message) => message.role === "assistant")).toBe(true);

    database.close();
  });
});
