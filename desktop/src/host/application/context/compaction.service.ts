import { generateText } from "ai";
import type { ChatMessage, ContextSegment } from "../../../shared/models/chat";
import type { ChatRepository } from "../../infrastructure/database/chat.repository";
import type { ProviderRegistry } from "../../infrastructure/text-generation/provider.registry";
import { resolveContextBudget, type ContextBudget } from "./context-budget";
import { buildContext, measureContext } from "./context-builder";
import { estimatePartsTokens } from "./token-estimator";

const LOCAL_MODEL_KIND = "ollama";

const SUMMARY_PROMPT = `Ты сжимаешь историю рабочего диалога программиста и ассистента, чтобы освободить контекстное окно.

Верни ТОЛЬКО сводку по строгой структуре ниже. Пиши по-русски, конспективно, без воды.
Сохраняй конкретику: точные пути файлов, имена функций, команды, сообщения об ошибках.

## Задача
## Принятые решения
## Изменённые файлы
## Что уже проверено
## Тупики
## Открытые вопросы
## Следующие шаги

Раздел «Тупики» обязателен: перечисли, что уже пробовали и почему не сработало.
Без него работа после сжатия пойдёт по второму кругу.`;

const KEEP_TAIL_MESSAGES = 6;
const MIN_COMPACTABLE_MESSAGES = 6;

export interface CompactionRequest {
  conversationId: string;
  runId: string | null;
  budget: ContextBudget;
  system: string;
  summarizerModelId: string;
  reason: ContextSegment["reason"];
  focus?: string;
  protectedFromMessageId?: string;
}

export class CompactionService {
  constructor(
    private readonly data: ChatRepository,
    private readonly providers: ProviderRegistry,
  ) {}

  shouldCompact(input: {
    conversationId: string;
    system: string;
    budget: ContextBudget;
    protectedFromMessageId?: string;
  }): boolean {
    const used = this.measure(input);
    return used > input.budget.compactAt;
  }

  measure(input: {
    conversationId: string;
    system: string;
    budget: ContextBudget;
    protectedFromMessageId?: string;
  }): number {
    return measureContext({
      system: input.system,
      messages: this.data.journalMessages(input.conversationId),
      segments: this.data.contextSegments(input.conversationId),
      budget: input.budget,
      protectedFromMessageId: input.protectedFromMessageId,
    });
  }

  async compact(request: CompactionRequest): Promise<ContextSegment | null> {
    const messages = this.data.journalMessages(request.conversationId);
    const range = selectRange(messages, request.protectedFromMessageId);
    if (range.length < MIN_COMPACTABLE_MESSAGES) return null;
    const firstMessage = range[0];
    const lastMessage = range[range.length - 1];
    if (!firstMessage || !lastMessage) return null;

    const tokensBefore = range.reduce(
      (sum, message) => sum + estimatePartsTokens(message.parts),
      0,
    );

    const summarizerModelId = this.pickSummarizerModel(
      request.summarizerModelId,
      tokensBefore,
    );
    const summarizerBudget = this.budgetFor(summarizerModelId);

    const transcript = buildContext({
      system: "",
      messages: range,
      segments: this.data.contextSegments(request.conversationId),
      budget: summarizerBudget,
      protectedFromMessageId: undefined,
    });

    const instruction = request.focus
      ? `${SUMMARY_PROMPT}\n\nОсобое внимание удели: ${request.focus}`
      : SUMMARY_PROMPT;

    const settings = this.providers.generationSettings(summarizerModelId);
    const result = await generateText({
      model: this.providers.resolve(summarizerModelId),
      temperature: 0.2,
      maxOutputTokens: Math.min(settings.maxOutputTokens, 2_048),
      system: instruction,
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
    if (!summary) return null;

    const segment = this.data.createContextSegment({
      conversationId: request.conversationId,
      fromMessageId: firstMessage.id,
      toMessageId: lastMessage.id,
      summary,
      modelId: summarizerModelId,
      messageCount: range.length,
      tokensBefore,
      tokensAfter: estimatePartsTokens([{ type: "text", text: summary }]),
      reason: request.reason,
    });
    this.data.markCompacted(
      range.map((message) => message.id),
      segment.id,
    );
    return segment;
  }

  private budgetFor(modelId: string): ContextBudget {
    const info = this.providers.modelInfo(modelId);
    const settings = this.providers.generationSettings(modelId);
    return resolveContextBudget({
      contextLength: info.contextLength,
      maxOutputTokens: settings.maxOutputTokens,
    });
  }

  private pickSummarizerModel(
    requestedModelId: string,
    tokensBefore: number,
  ): string {
    const local = this.data
      .listEnabledTextModels()
      .filter(
        (model) =>
          model.kind === LOCAL_MODEL_KIND && model.id !== requestedModelId,
      )
      .sort((left, right) => right.contextLength - left.contextLength);
    for (const candidate of local) {
      if (this.budgetFor(candidate.id).usable >= tokensBefore)
        return candidate.id;
    }
    return requestedModelId;
  }
}

function selectRange(
  messages: ChatMessage[],
  protectedFromMessageId?: string,
): ChatMessage[] {
  const candidates: ChatMessage[] = [];
  for (const message of messages) {
    if (protectedFromMessageId && message.id >= protectedFromMessageId) break;
    if (message.compactedInto) continue;
    if (message.role === "system") continue;
    candidates.push(message);
  }
  return candidates.slice(
    0,
    Math.max(0, candidates.length - KEEP_TAIL_MESSAGES),
  );
}
