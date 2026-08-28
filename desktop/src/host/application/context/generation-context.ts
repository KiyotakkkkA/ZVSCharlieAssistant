import { generateText } from "ai";
import type { ChatMessageContentPart } from "../../../shared/dto";
import type { ChatMessage, ContextSegment } from "../../../shared/models/chat";
import type { ProviderRegistry } from "../../infrastructure/text-generation/provider.registry";
import { resolveContextBudget, type ContextBudget } from "./context-budget";
import { buildContext, measureContext, type BuiltContext } from "./context-builder";
import { estimatePartsTokens } from "./token-estimator";

const LOCAL_MODEL_KIND = "ollama";
const KEEP_TAIL_MESSAGES = 4;
const MIN_COMPACTABLE_MESSAGES = 6;

const GENERATION_SUMMARY_PROMPT = `Ты сжимаешь промежуточную историю фоновой генерации сущности (агента, навыка или сценария), чтобы освободить контекстное окно модели.

Верни ТОЛЬКО сводку по строгой структуре ниже. Пиши по-русски, конспективно, без воды.
Сохраняй конкретику: точные значения полей, названия узлов/инструментов, формулировки уточняющих вопросов и ответов на них.

## Исходный запрос пользователя
## Что уже решено (значения полей, структура)
## Результаты вызовов инструментов
## Заданные уточняющие вопросы и ответы
## Что осталось сделать

Если какого-то раздела нет данных — опусти его.`;

export interface EnabledModelInfo {
  id: string;
  kind: string;
  contextLength: number;
  maxCompletionTokens: number;
}

export class InMemoryCompactor {
  private messages: ChatMessage[] = [];
  private segments: ContextSegment[] = [];
  private nextIndex = 0;

  constructor(private readonly runId: string) {}

  get currentMessages(): ChatMessage[] {
    return this.messages;
  }

  get currentSegments(): ContextSegment[] {
    return this.segments;
  }

  appendUser(parts: ChatMessageContentPart[]): void {
    this.push("user", parts);
  }

  appendAssistant(parts: ChatMessageContentPart[]): void {
    this.push("assistant", parts);
  }

  buildStepContext(system: string, budget: ContextBudget): BuiltContext {
    return buildContext({
      system,
      messages: this.messages,
      segments: this.segments,
      budget,
    });
  }

  measure(system: string, budget: ContextBudget): number {
    return measureContext({
      system,
      messages: this.messages,
      segments: this.segments,
      budget,
    });
  }

  shouldCompact(system: string, budget: ContextBudget): boolean {
    return this.measure(system, budget) > budget.compactAt;
  }

  async compact(options: {
    providers: ProviderRegistry;
    listEnabledModels: () => EnabledModelInfo[];
    summarizerModelId: string;
    reason: ContextSegment["reason"];
  }): Promise<boolean> {
    const range = selectRange(this.messages);
    if (range.length < MIN_COMPACTABLE_MESSAGES) return false;
    const first = range[0]!;
    const last = range[range.length - 1]!;
    const tokensBefore = range.reduce(
      (sum, message) => sum + estimatePartsTokens(message.parts),
      0,
    );

    const summarizerModelId = pickSummarizerModel(
      options.providers,
      options.listEnabledModels(),
      options.summarizerModelId,
      tokensBefore,
    );
    const summarizerBudget = budgetFor(options.providers, summarizerModelId);
    const transcript = buildContext({
      system: "",
      messages: range,
      segments: [],
      budget: summarizerBudget,
    });

    const settings = options.providers.generationSettings(summarizerModelId);
    const result = await generateText({
      model: options.providers.resolve(summarizerModelId),
      temperature: 0.2,
      maxOutputTokens: Math.min(settings.maxOutputTokens, 1_024),
      system: GENERATION_SUMMARY_PROMPT,
      messages: [
        ...transcript.messages,
        {
          role: "user",
          content:
            "Сожми всё, что было выше, по заданной структуре. Верни только сводку.",
        },
      ],
    });

    const summary = result.text.trim();
    if (!summary) return false;

    const segmentId = `${this.runId}:segment:${this.segments.length}`;
    this.segments.push({
      id: segmentId,
      conversationId: this.runId,
      fromMessageId: first.id,
      toMessageId: last.id,
      summary,
      modelId: summarizerModelId,
      messageCount: range.length,
      tokensBefore,
      tokensAfter: estimatePartsTokens([{ type: "text", text: summary }]),
      reason: options.reason,
      createdAt: new Date().toISOString(),
    });
    const compactedIds = new Set(range.map((message) => message.id));
    this.messages = this.messages.map((message) =>
      compactedIds.has(message.id)
        ? { ...message, compactedInto: segmentId }
        : message,
    );
    return true;
  }

  private push(role: ChatMessage["role"], parts: ChatMessageContentPart[]): void {
    const id = `${this.runId}:${String(this.nextIndex).padStart(6, "0")}`;
    this.nextIndex += 1;
    this.messages.push({
      id,
      conversationId: this.runId,
      runId: this.runId,
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
      compactedInto: null,
      tokenCount: 0,
      createdAt: new Date().toISOString(),
    });
  }
}

function selectRange(messages: ChatMessage[]): ChatMessage[] {
  const candidates = messages.filter(
    (message) => !message.compactedInto && message.role !== "system",
  );
  return candidates.slice(0, Math.max(0, candidates.length - KEEP_TAIL_MESSAGES));
}

function budgetFor(providers: ProviderRegistry, modelId: string): ContextBudget {
  const info = providers.modelInfo(modelId);
  const settings = providers.generationSettings(modelId);
  return resolveContextBudget({
    contextLength: info.contextLength,
    maxOutputTokens: settings.maxOutputTokens,
  });
}

function pickSummarizerModel(
  providers: ProviderRegistry,
  enabled: EnabledModelInfo[],
  requestedModelId: string,
  tokensBefore: number,
): string {
  const local = enabled
    .filter(
      (model) => model.kind === LOCAL_MODEL_KIND && model.id !== requestedModelId,
    )
    .sort((left, right) => right.contextLength - left.contextLength);
  for (const candidate of local) {
    if (budgetFor(providers, candidate.id).usable >= tokensBefore)
      return candidate.id;
  }
  return requestedModelId;
}
