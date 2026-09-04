import type { TextProviderModelDetails } from "../../../shared/dto";
import { formatContext } from "@renderer/lib/format";

interface Props {
  details: Partial<TextProviderModelDetails>;
  showContext?: boolean;
  showPricing?: boolean;
}

const usdPerMillion = (value?: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  if (amount === 0) return "бесплатно";
  return `$${(amount * 1_000_000).toLocaleString("ru-RU", {
    maximumFractionDigits: 4,
  })}/1M`;
};

export function ModelCatalogFacts({
  details,
  showContext = false,
  showPricing = false,
}: Props) {
  const facts: string[] = [];
  if (showContext && details.contextLength)
    facts.push(`Контекст: ${formatContext(details.contextLength)}`);
  if (showContext && details.maxCompletionTokens)
    facts.push(`Ответ: ${formatContext(details.maxCompletionTokens)}`);
  if (showPricing) {
    const input = usdPerMillion(details.promptPrice);
    const output = usdPerMillion(details.completionPrice);
    if (input) facts.push(`Вход: ${input}`);
    if (output) facts.push(`Выход: ${output}`);
  }
  if (details.knowledgeCutoff)
    facts.push(`Знания до ${details.knowledgeCutoff}`);
  if (details.openWeights) facts.push("Открытые веса");

  if (!facts.length && !details.catalogSource) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-main-500">
      {facts.map((fact) => (
        <span key={fact}>{fact}</span>
      ))}
      {details.catalogSource ? (
        <span
          title="Часть характеристик дополнена из каталога models.dev"
          className="rounded-full bg-main-700/50 px-2 py-0.5 text-[10px] text-main-400"
        >
          models.dev
        </span>
      ) : null}
    </div>
  );
}
