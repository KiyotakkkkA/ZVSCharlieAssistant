import type { ModelMessage } from "ai";
import type {
  ChatMessageContentPart,
  ChatToolCallPart,
  ChatToolResultPart,
  JsonValue,
} from "../../../shared/dto";
import type { ChatMessage, ContextSegment } from "../../../shared/models/chat";
import type { ContextBudget } from "./context-budget";
import { estimatePartsTokens, estimateTextTokens } from "./token-estimator";

export type ReductionKind =
  | "truncate_tool_results"
  | "dedupe_reads"
  | "collapse_failures"
  | "drop_oldest";

export interface BuiltContext {
  messages: ModelMessage[];
  tokens: number;
  reductions: ReductionKind[];
  overflow: boolean;
}

export interface BuildContextInput {
  system: string;
  messages: ChatMessage[];
  segments: ContextSegment[];
  budget: ContextBudget;
  protectedFromMessageId?: string;
}

interface WorkingMessage {
  id: string;
  role: ChatMessage["role"];
  parts: ChatMessageContentPart[];
  protectedMessage: boolean;
}

const KEEP_INTACT_TOOL_RESULTS = 4;
const TOOL_RESULT_MAX_CHARS = 4_000;
const TOOL_RESULT_HARD_MAX_CHARS = 800;

const READ_TOOL_NAMES = new Set(["fs_read", "fs_list"]);

export function buildContext(input: BuildContextInput): BuiltContext {
  const working = prepare(input);
  const reductions: ReductionKind[] = [];
  const systemTokens = estimateTextTokens(input.system);
  const limit = input.budget.hardStop;

  const total = () => systemTokens + totalTokens(working);

  if (total() > limit) {
    truncateToolResults(working, TOOL_RESULT_MAX_CHARS);
    reductions.push("truncate_tool_results");
  }
  if (total() > limit) {
    dedupeReads(working);
    reductions.push("dedupe_reads");
  }
  if (total() > limit) {
    collapseFailures(working);
    reductions.push("collapse_failures");
  }
  if (total() > limit) {
    truncateToolResults(working, TOOL_RESULT_HARD_MAX_CHARS);
  }
  if (total() > limit) {
    dropOldest(working, limit - systemTokens);
    reductions.push("drop_oldest");
  }

  const tokens = total();
  return {
    messages: expand(working),
    tokens,
    reductions,
    overflow: tokens > limit,
  };
}

export function measureContext(input: BuildContextInput): number {
  return (
    estimateTextTokens(input.system) + totalTokens(prepare(input))
  );
}

function prepare(input: BuildContextInput): WorkingMessage[] {
  const segmentsByStart = new Map<string, ContextSegment>();
  const covered = new Set<string>();
  for (const segment of input.segments) {
    segmentsByStart.set(segment.fromMessageId, segment);
  }
  for (const message of input.messages) {
    if (message.compactedInto) covered.add(message.id);
  }

  const protectedFrom = input.protectedFromMessageId;
  let insideProtected = false;

  const working: WorkingMessage[] = [];
  for (const message of input.messages) {
    if (protectedFrom !== undefined && message.id === protectedFrom)
      insideProtected = true;

    const segment = segmentsByStart.get(message.id);
    if (segment) {
      working.push({
        id: `segment:${segment.id}`,
        role: "user",
        parts: [
          {
            type: "summary",
            text: segment.summary,
            segmentId: segment.id,
            messageCount: segment.messageCount,
            tokensBefore: segment.tokensBefore,
            tokensAfter: segment.tokensAfter,
          },
        ],
        protectedMessage: true,
      });
    }
    if (covered.has(message.id)) continue;
    if (message.role === "system") continue;

    const parts = sanitizeParts(message.parts, message.status);
    if (!parts.length) continue;
    working.push({
      id: message.id,
      role: message.role,
      parts,
      protectedMessage: insideProtected,
    });
  }
  return working;
}

function sanitizeParts(
  parts: ChatMessageContentPart[],
  status: ChatMessage["status"],
): ChatMessageContentPart[] {
  const kept = parts.filter((part) => part.type !== "reasoning");
  const resolved = new Set(
    kept
      .filter((part): part is ChatToolResultPart => part.type === "tool-result")
      .map((part) => part.toolCallId),
  );
  const result: ChatMessageContentPart[] = [];
  for (const part of kept) {
    if (part.type === "text" && !part.text.trim()) continue;
    result.push(part);
    if (part.type === "tool-call" && !resolved.has(part.toolCallId)) {
      result.push({
        type: "tool-result",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        output: {
          error:
            status === "cancelled"
              ? "Вызов прерван пользователем"
              : "Вызов не завершён",
        },
        isError: true,
      });
    }
  }
  return result;
}

function totalTokens(working: WorkingMessage[]): number {
  return working.reduce(
    (sum, message) => sum + estimatePartsTokens(message.parts),
    0,
  );
}

function truncateToolResults(working: WorkingMessage[], maxChars: number) {
  const results: Array<{ message: WorkingMessage; index: number }> = [];
  for (const message of working) {
    message.parts.forEach((part, index) => {
      if (part.type === "tool-result") results.push({ message, index });
    });
  }
  const truncatable = results.slice(
    0,
    Math.max(0, results.length - KEEP_INTACT_TOOL_RESULTS),
  );
  for (const { message, index } of truncatable) {
    const part = message.parts[index];
    if (!part || part.type !== "tool-result") continue;
    const truncated = truncateOutput(part.output, maxChars, part.toolCallId);
    if (truncated === part.output) continue;
    message.parts[index] = { ...part, output: truncated, truncated: true };
  }
}

function truncateOutput(
  output: JsonValue,
  maxChars: number,
  toolCallId: string,
): JsonValue {
  const text = typeof output === "string" ? output : safeStringify(output);
  if (text.length <= maxChars) return output;
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  const omitted = text.length - maxChars;
  return {
    truncated: true,
    hint: `Результат усечён: опущено ${omitted} символов. Полный результат доступен через read_tool_output("${toolCallId}").`,
    head: text.slice(0, head),
    tail: text.slice(text.length - tail),
  };
}

function dedupeReads(working: WorkingMessage[]) {
  const lastSeen = new Map<string, { message: WorkingMessage; index: number }>();
  for (const message of working) {
    if (message.protectedMessage) continue;
    message.parts.forEach((part, index) => {
      if (part.type !== "tool-call") return;
      if (!READ_TOOL_NAMES.has(part.toolName)) return;
      const key = `${part.toolName}:${safeStringify(readTarget(part))}`;
      const previous = lastSeen.get(key);
      if (previous) collapseResultFor(previous, "Заменено более свежим чтением");
      lastSeen.set(key, { message, index });
    });
  }
}

function readTarget(part: ChatToolCallPart): unknown {
  const input = part.input as { path?: unknown; base?: unknown } | null;
  if (input && typeof input === "object")
    return input.path ?? input.base ?? input;
  return input;
}

function collapseResultFor(
  location: { message: WorkingMessage; index: number },
  reason: string,
) {
  const call = location.message.parts[location.index];
  if (!call || call.type !== "tool-call") return;
  const callId = call.toolCallId;
  const resultIndex = location.message.parts.findIndex(
    (part) => part.type === "tool-result" && part.toolCallId === callId,
  );
  const result = location.message.parts[resultIndex];
  if (!result || result.type !== "tool-result") return;
  location.message.parts[resultIndex] = {
    ...result,
    output: { collapsed: reason },
    truncated: true,
  };
}

function collapseFailures(working: WorkingMessage[]) {
  for (const message of working) {
    if (message.protectedMessage) continue;
    const failures = message.parts.filter(
      (part): part is ChatToolResultPart =>
        part.type === "tool-result" && part.isError === true,
    );
    if (failures.length < 2) continue;
    let first = true;
    message.parts = message.parts.map((part) => {
      if (part.type !== "tool-result" || part.isError !== true) return part;
      if (first) {
        first = false;
        return part;
      }
      return {
        ...part,
        output: { collapsed: `Ещё одна неудачная попытка ${part.toolName}` },
        truncated: true,
      };
    });
  }
}

function dropOldest(working: WorkingMessage[], limit: number) {
  while (working.length > 1 && totalTokens(working) > limit) {
    const index = working.findIndex((message) => !message.protectedMessage);
    if (index < 0) break;
    working.splice(index, 1);
  }
}

function expand(working: WorkingMessage[]): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const message of working) {
    if (message.role === "user") {
      messages.push({ role: "user", content: renderUserContent(message.parts) });
      continue;
    }
    if (message.role === "tool") {
      const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
      if (text.trim()) messages.push({ role: "user", content: text });
      continue;
    }

    let assistantBuffer: Array<
      { type: "text"; text: string } | ChatToolCallPart
    > = [];
    let toolBuffer: ChatToolResultPart[] = [];

    const flushAssistant = () => {
      if (!assistantBuffer.length) return;
      messages.push({
        role: "assistant",
        content: assistantBuffer.map((part) =>
          part.type === "text"
            ? { type: "text" as const, text: part.text }
            : {
                type: "tool-call" as const,
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                input: part.input,
              },
        ),
      } as ModelMessage);
      assistantBuffer = [];
    };
    const flushTools = () => {
      if (!toolBuffer.length) return;
      messages.push({
        role: "tool",
        content: toolBuffer.map((part) => ({
          type: "tool-result" as const,
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: toToolOutput(part),
        })),
      } as ModelMessage);
      toolBuffer = [];
    };

    for (const part of message.parts) {
      if (part.type === "tool-result") {
        flushAssistant();
        toolBuffer.push(part);
        continue;
      }
      flushTools();
      if (part.type === "text") assistantBuffer.push({ type: "text", text: part.text });
      else if (part.type === "tool-call") assistantBuffer.push(part);
      else if (part.type === "summary")
        assistantBuffer.push({ type: "text", text: part.text });
    }
    flushAssistant();
    flushTools();
  }

  while (messages.length && messages[0]?.role === "tool") messages.shift();
  return messages;
}

function renderUserContent(parts: ChatMessageContentPart[]): string {
  return parts
    .map((part) => {
      if (part.type === "summary")
        return `<context_summary messages="${part.messageCount}">\n${part.text}\n</context_summary>`;
      if (part.type === "text") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function toToolOutput(part: ChatToolResultPart) {
  if (part.isError)
    return {
      type: "error-text" as const,
      value:
        typeof part.output === "string"
          ? part.output
          : safeStringify(part.output),
    };
  if (typeof part.output === "string")
    return { type: "text" as const, value: part.output };
  return { type: "json" as const, value: part.output };
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
