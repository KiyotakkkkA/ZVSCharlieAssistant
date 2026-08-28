import { describe, expect, it } from "vitest";
import {
  buildContext,
  measureContext,
} from "../../src/host/application/context/context-builder";
import { resolveContextBudget } from "../../src/host/application/context/context-budget";
import type { ChatMessage, ContextSegment } from "../../src/shared/models/chat";
import type { ChatMessageContentPart } from "../../src/shared/dto";

function message(
  id: string,
  role: ChatMessage["role"],
  parts: ChatMessageContentPart[],
  compactedInto: string | null = null,
): ChatMessage {
  return {
    id,
    conversationId: "c1",
    runId: "r1",
    scenarioRunId: null,
    role,
    status: "completed",
    parts,
    text: parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(""),
    reasoning: "",
    error: null,
    toolCalls: [],
    lastUsage: { mode: "agent" },
    compactedInto,
    tokenCount: 0,
    createdAt: "2026-08-24T00:00:00Z",
  };
}

const budget = resolveContextBudget({
  contextLength: 8_000,
  maxOutputTokens: 1_000,
});

describe("сборка контекста из журнала", () => {
  it("разворачивает вызов инструмента в пару assistant + tool", () => {
    const built = buildContext({
      system: "система",
      segments: [],
      budget,
      messages: [
        message("m1", "user", [{ type: "text", text: "почини сборку" }]),
        message("m2", "assistant", [
          { type: "text", text: "смотрю файл" },
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "fs_read",
            input: { path: "C:/app/index.ts" },
          },
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "fs_read",
            output: { content: "1\tconst a = 1" },
          },
          { type: "text", text: "нашёл причину" },
        ]),
      ],
    });

    expect(built.messages.map((item) => item.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
  });

  it("теряет результат инструмента, если он лежит отдельным сообщением role=tool", () => {
    const built = buildContext({
      system: "",
      segments: [],
      budget,
      messages: [
        message("m1", "user", [{ type: "text", text: "старт" }]),
        message("m2", "assistant", [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "get_node_schema",
            input: { kinds: ["output"] },
          },
        ]),
        message("m3", "tool", [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "get_node_schema",
            output: { marker: "SCHEMA_PAYLOAD_MARKER" },
          },
        ]),
      ],
    });

    const flat = JSON.stringify(built.messages);
    expect(flat).not.toContain("SCHEMA_PAYLOAD_MARKER");
    expect(flat).toContain("Вызов не завершён");
  });

  it("не оставляет вызов инструмента без результата", () => {
    const built = buildContext({
      system: "",
      segments: [],
      budget,
      messages: [
        message("m1", "user", [{ type: "text", text: "старт" }]),
        message("m2", "assistant", [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "cmd_exec",
            input: { action: "start" },
          },
        ]),
      ],
    });

    const toolMessages = built.messages.filter((item) => item.role === "tool");
    expect(toolMessages).toHaveLength(1);
  });

  it("не переносит reasoning между запросами", () => {
    const built = buildContext({
      system: "",
      segments: [],
      budget,
      messages: [
        message("m1", "user", [{ type: "text", text: "вопрос" }]),
        message("m2", "assistant", [
          { type: "reasoning", text: "внутренние рассуждения" },
          { type: "text", text: "ответ" },
        ]),
      ],
    });

    expect(JSON.stringify(built.messages)).not.toContain(
      "внутренние рассуждения",
    );
  });

  it("заменяет сжатый диапазон одной сводкой", () => {
    const segment: ContextSegment = {
      id: "s1",
      conversationId: "c1",
      fromMessageId: "m1",
      toMessageId: "m2",
      summary: "Ранее: разобрались с конфигом",
      modelId: null,
      messageCount: 2,
      tokensBefore: 900,
      tokensAfter: 40,
      reason: "threshold",
      createdAt: "2026-08-24T00:00:00Z",
    };
    const built = buildContext({
      system: "",
      segments: [segment],
      budget,
      messages: [
        message("m1", "user", [{ type: "text", text: "первое" }], "s1"),
        message("m2", "assistant", [{ type: "text", text: "второе" }], "s1"),
        message("m3", "user", [{ type: "text", text: "третье" }]),
      ],
    });

    const flat = JSON.stringify(built.messages);
    expect(flat).toContain("Ранее: разобрались с конфигом");
    expect(flat).not.toContain("первое");
    expect(flat).toContain("третье");
  });

  it("укладывается в бюджет за счёт редукций", () => {
    const tiny = resolveContextBudget({
      contextLength: 4_000,
      maxOutputTokens: 512,
    });
    const noisy = Array.from({ length: 40 }, (_, index) =>
      message(`m${index.toString().padStart(3, "0")}`, "assistant", [
        {
          type: "tool-call",
          toolCallId: `call-${index}`,
          toolName: "cmd_exec",
          input: { action: "start", script: "npm test" },
        },
        {
          type: "tool-result",
          toolCallId: `call-${index}`,
          toolName: "cmd_exec",
          output: { stdout: "x".repeat(4_000) },
        },
      ]),
    );
    const messages = [
      message("m000_user", "user", [{ type: "text", text: "прогон тестов" }]),
      ...noisy,
    ];

    const before = measureContext({
      system: "",
      segments: [],
      budget: tiny,
      messages,
    });
    const built = buildContext({
      system: "",
      segments: [],
      budget: tiny,
      messages,
    });

    expect(before).toBeGreaterThan(tiny.hardStop);
    expect(built.tokens).toBeLessThanOrEqual(tiny.hardStop);
    expect(built.reductions).toContain("truncate_tool_results");
  });

  it("не редуцирует защищённый хвост текущей задачи", () => {
    const messages = [
      message("m1", "user", [{ type: "text", text: "старое" }]),
      message("m2", "user", [{ type: "text", text: "текущее задание" }]),
    ];
    const built = buildContext({
      system: "",
      segments: [],
      budget,
      messages,
      protectedFromMessageId: "m2",
    });
    expect(JSON.stringify(built.messages)).toContain("текущее задание");
  });
});
