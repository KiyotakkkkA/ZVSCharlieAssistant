import { InputCheckSlided } from "@kiyotakkkka/zvs-uikit-lib";
import type { TextProviderModelInfo } from "../../../shared/models/text-provider";
import { OpenrouterIcon } from "../atoms";

interface Props {
  model: TextProviderModelInfo;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

const usdPerMillion = (value?: string) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `$${(amount * 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 4 })}/1M`
    : "—";
};

export function SettingsProviderOpenrouterModelCard({
  model,
  enabled,
  onEnabledChange,
}: Props) {
  const details = model.details;
  return (
    <article className="flex items-center gap-3 rounded-xl bg-main-700/20 p-3 transition-colors hover:bg-main-700/35">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-300">
        <OpenrouterIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-sm font-medium text-main-100">
            {model.name}
          </h4>
          {details.contextLength ? (
            <span className="shrink-0 rounded-full bg-main-700/60 px-2 py-0.5 text-[10px] text-main-400">
              {details.contextLength.toLocaleString("ru-RU")} токенов
            </span>
          ) : null}
          {details.isModerated ? (
            <span className="shrink-0 rounded-full bg-main-700/60 px-2 py-0.5 text-[10px] text-main-400">
              Модерируется
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate font-mono text-[11px] text-main-500">
          {model.id}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-main-500">
          <span>Вход: {usdPerMillion(details.promptPrice)}</span>
          <span>Выход: {usdPerMillion(details.completionPrice)}</span>
          {details.outputModalities?.length ? (
            <span>{details.outputModalities.join(", ")}</span>
          ) : null}
        </div>
      </div>
      <InputCheckSlided checked={enabled} onChange={onEnabledChange} />
    </article>
  );
}
