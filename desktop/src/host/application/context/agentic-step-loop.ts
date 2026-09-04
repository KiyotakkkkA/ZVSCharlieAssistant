import { streamText, stepCountIs, type ModelMessage, type ToolSet } from "ai";
import type { ChatMessageContentPart, JsonValue } from "../../../shared/dto";
import type { ContextBudget } from "./context-budget";
import type { ProviderRegistry } from "../../infrastructure/text-generation/provider.registry";
import type {
  ModelFailover,
  ModelRequirements,
} from "../../infrastructure/text-generation/model-failover";

interface GenerationStreamPart {
  type: string;
  id?: string;
  delta?: string;
  text?: string;
  error?: unknown;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  finishReason?: string;
  rawFinishReason?: string;
  usage?: unknown;
  totalUsage?: unknown;
}

export interface PartialToolInput {
  toolName: string;
  receivedBytes: number;
}

export interface ConsumedStep {
  text: string;
  reasoning: string;
  toolCallParts: ChatMessageContentPart[];
  resultParts: ChatMessageContentPart[];
  hasToolCalls: boolean;
  finishReason?: string;
  rawFinishReason?: string;
  /** Сырое usage провайдера — нормализацию делает вызывающая сторона. */
  usage?: unknown;
  /** Заполнен, если поток оборвался посреди JSON аргументов инструмента. */
  interruptedToolInput?: PartialToolInput;
}

export interface StreamConsumeHooks {
  onTextDelta?(delta: string): void;
  onReasoningDelta?(delta: string): void;
  onToolCall?(part: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  }): void;
  onToolResult?(part: {
    toolCallId: string;
    toolName: string;
    output: unknown;
    isError?: boolean;
  }): void;
  /**
   * Если задан, ошибка потока не прерывает чтение: поток дочитывается до конца
   * (чтобы забрать терминальный `finish`), после чего хук решает, считать ли
   * обрыв восстановимым. Вернув переопределение причины остановки — шаг
   * возвращается как обычный результат, вернув `undefined` — ошибка бросается.
   */
  recoverStreamError?(
    error: Error,
    step: ConsumedStep,
  ): { finishReason?: string; rawFinishReason?: string } | undefined;
  /** Вызывается после сбора шага и до возможного броска ошибки потока. */
  onStepComplete?(step: ConsumedStep): void;
}

export async function consumeModelStream(
  stream: AsyncIterable<unknown>,
  hooks?: StreamConsumeHooks,
): Promise<ConsumedStep> {
  let textAccum = "";
  let reasoningAccum = "";
  let finishReason: string | undefined;
  let rawFinishReason: string | undefined;
  let usage: unknown;
  let streamError: Error | undefined;
  const toolCallParts: ChatMessageContentPart[] = [];
  const resultParts: ChatMessageContentPart[] = [];
  const partialToolInputs = new Map<string, PartialToolInput>();

  for await (const raw of stream) {
    const part = raw as GenerationStreamPart;
    if (part.type === "error") {
      const error = normalizeStreamError(part.error);
      if (!hooks?.recoverStreamError) throw error;
      streamError ??= error;
    } else if (part.type === "tool-input-start") {
      partialToolInputs.set(part.id ?? "", {
        toolName: part.toolName ?? "unknown",
        receivedBytes: 0,
      });
    } else if (part.type === "tool-input-delta") {
      const current = partialToolInputs.get(part.id ?? "");
      if (current)
        current.receivedBytes += Buffer.byteLength(part.delta ?? "", "utf8");
    } else if (part.type === "finish-step" || part.type === "finish") {
      finishReason = part.finishReason ?? finishReason;
      rawFinishReason = part.rawFinishReason ?? rawFinishReason;
      usage = part.usage ?? part.totalUsage ?? usage;
    } else if (part.type === "text-delta") {
      textAccum += part.text ?? "";
      hooks?.onTextDelta?.(part.text ?? "");
    } else if (part.type === "reasoning-delta") {
      reasoningAccum += part.text ?? "";
      hooks?.onReasoningDelta?.(part.text ?? "");
    } else if (part.type === "tool-call") {
      const toolCallId = part.toolCallId ?? "";
      const toolName = part.toolName ?? "";
      partialToolInputs.delete(toolCallId);
      toolCallParts.push({
        type: "tool-call",
        toolCallId,
        toolName,
        input: (part.input ?? null) as JsonValue,
      });
      hooks?.onToolCall?.({ toolCallId, toolName, input: part.input ?? null });
    } else if (part.type === "tool-result") {
      const toolCallId = part.toolCallId ?? "";
      const toolName = part.toolName ?? "";
      resultParts.push({
        type: "tool-result",
        toolCallId,
        toolName,
        output: (part.output ?? null) as JsonValue,
      });
      hooks?.onToolResult?.({
        toolCallId,
        toolName,
        output: part.output ?? null,
      });
    } else if (part.type === "tool-error") {
      const toolCallId = part.toolCallId ?? "";
      const toolName = part.toolName ?? "";
      const output = errorToJson(part.error);
      resultParts.push({
        type: "tool-result",
        toolCallId,
        toolName,
        output,
        isError: true,
      });
      hooks?.onToolResult?.({ toolCallId, toolName, output, isError: true });
    }
  }

  const step: ConsumedStep = {
    text: textAccum,
    reasoning: reasoningAccum,
    toolCallParts,
    resultParts,
    hasToolCalls: toolCallParts.length > 0,
    finishReason,
    rawFinishReason,
    usage,
    interruptedToolInput: partialToolInputs.values().next().value,
  };

  let recovered = false;
  if (streamError && hooks?.recoverStreamError) {
    const override = hooks.recoverStreamError(streamError, step);
    if (override) {
      recovered = true;
      step.finishReason = override.finishReason ?? step.finishReason;
      step.rawFinishReason = override.rawFinishReason ?? step.rawFinishReason;
    }
  }
  hooks?.onStepComplete?.(step);
  if (streamError && !recovered) throw streamError;
  return step;
}

export interface StepRetryInput {
  providers: ProviderRegistry;
  failover: ModelFailover;
  activeModelId: string;
  system: string;
  tools?: ToolSet;
  requiresStructuredOutput?: boolean;
  /** Не задан — берётся `maxOutputTokens` из настроек генерации модели. */
  maxOutputTokens?: number;
  temperature?: number | null;
  topP?: number | null;
  abortSignal: AbortSignal;
  budgetFor(modelId: string): ContextBudget;
  buildMessages(budget: ContextBudget, modelId: string): ModelMessage[];
  compact(
    compacted: boolean,
    budget: ContextBudget,
    modelId: string,
  ): Promise<void>;
  recoverStreamError?: StreamConsumeHooks["recoverStreamError"];
  onStepComplete?: StreamConsumeHooks["onStepComplete"];
  onDelta?(delta: string): void;
  onReasoningDelta?(delta: string): void;
  onToolCall?(part: {
    toolCallId: string;
    toolName: string;
    input: unknown;
  }): void;
  onToolResult?(part: {
    toolCallId: string;
    toolName: string;
    output: unknown;
    isError?: boolean;
  }): void;
  onModelSwitch?(
    modelId: string,
    reason: string,
    detail: string,
    required?: string[],
  ): void;
  onFail?(error: unknown): void;
}

export interface StepRetryResult extends ConsumedStep {
  activeModelId: string;
}

export async function runStepWithRetry(
  input: StepRetryInput,
): Promise<StepRetryResult> {
  let activeModelId = input.activeModelId;
  let compacted = false;

  for (let attempt = 0; ;) {
    input.abortSignal.throwIfAborted();
    const settings = input.providers.generationSettings(activeModelId);
    const budget = input.budgetFor(activeModelId);
    await input.compact(compacted, budget, activeModelId);
    const messages = input.buildMessages(budget, activeModelId);
    const requires: ModelRequirements = {
      tools: Boolean(input.tools && Object.keys(input.tools).length),
      structuredOutput: input.requiresStructuredOutput === true,
      vision: hasImageInput(messages),
    };

    try {
      const result = streamText({
        model: input.providers.resolve(activeModelId),
        system: input.system,
        messages,
        tools: input.tools,
        stopWhen: stepCountIs(1),
        abortSignal: input.abortSignal,
        maxOutputTokens:
          input.maxOutputTokens === undefined
            ? settings.maxOutputTokens
            : Math.min(input.maxOutputTokens, settings.maxOutputTokens),
        temperature: input.temperature ?? settings.temperature,
        topP: input.topP ?? settings.topP,
      });
      const step = await consumeModelStream(result.stream, {
        onTextDelta: input.onDelta,
        onReasoningDelta: input.onReasoningDelta,
        onToolCall: input.onToolCall,
        onToolResult: input.onToolResult,
        recoverStreamError: input.recoverStreamError,
        onStepComplete: input.onStepComplete,
      });
      return { ...step, activeModelId };
    } catch (error) {
      if (input.abortSignal.aborted) {
        input.onFail?.(error);
        throw error;
      }
      const decision = input.failover.decide(error, {
        activeModelId,
        attempt,
        compacted,
        requires,
      });
      if (decision.kind === "fail") {
        input.onFail?.(error);
        if (decision.message)
          throw new Error(decision.message, { cause: error });
        throw error;
      }
      if (decision.kind === "retry") {
        attempt += 1;
        await delay(decision.delayMs);
        continue;
      }
      if (decision.kind === "compact") {
        compacted = true;
        continue;
      }
      activeModelId = decision.modelId;
      input.onModelSwitch?.(
        decision.modelId,
        decision.reason,
        decision.detail,
        decision.required,
      );
      attempt = 0;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToJson(error: unknown): JsonValue {
  if (error instanceof Error) return { error: error.message };
  if (typeof error === "string") return { error };
  return { error: "Инструмент завершился с ошибкой" };
}

function normalizeStreamError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim())
      return Object.assign(new Error(message, { cause: error }), error);
  }
  return new Error("Ошибка при обращении к модели");
}

function hasImageInput(messages: ModelMessage[]): boolean {
  return messages.some((message) => {
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) return false;
    return content.some(
      (part) => (part as { type?: unknown } | null)?.type === "image",
    );
  });
}
