export type GenerationLimitKind = "output_limit" | "context_overflow";

export function generationLimitKind(
  finishReason: string | undefined,
  rawFinishReason: string | undefined,
): GenerationLimitKind | undefined {
  const raw = (rawFinishReason ?? "").toLocaleLowerCase("en-US");
  if (CONTEXT_LIMIT_PATTERN.test(raw)) return "context_overflow";
  if (finishReason === "length" || OUTPUT_LIMIT_PATTERN.test(raw))
    return "output_limit";
  return undefined;
}

export function limitFailureMessage(kind: GenerationLimitKind): string {
  return kind === "context_overflow"
    ? "Контекстное окно модели исчерпано. Автоматическое сжатие и переключение на модель с большим контекстом не помогли."
    : "Модель исчерпала лимит ответа. Автоматические продолжения и переключение на модель с большим лимитом вывода не помогли.";
}

export function isMissingFinishReasonError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /(?:response\s+)?stream\s+ended\s+without\s+(?:a\s+)?finish\s+reason/i.test(
    message,
  );
}

const CONTEXT_LIMIT_PATTERN =
  /context(?:_|\s|-)*(?:length|window|limit)|prompt(?:_|\s|-)*(?:too long|tokens? limit)|input(?:_|\s|-)*(?:too long|length)|num_ctx/i;
const OUTPUT_LIMIT_PATTERN =
  /max(?:imum)?(?:_|\s|-)*(?:output|completion)?(?:_|\s|-)*tokens?|token(?:_|\s|-)*limit|model_length|length|incomplete_tool_input/i;
