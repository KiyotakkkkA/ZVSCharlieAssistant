import { InputCheckSlided } from "@kiyotakkkka/zvs-uikit-lib";
import type { TextProviderModelInfo } from "../../../shared/models/text-provider";
import { MistralIcon, OpenInNewIcon } from "../atoms";
import { formatContext } from "@renderer/lib/format";
import { ModelCapabilityChips } from "./ModelCapabilityChips";
import type { ModelCapabilityKey } from "../../../shared/models/model-capabilities";

interface Props {
  model: TextProviderModelInfo;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onCapabilityOverride?: (
    key: ModelCapabilityKey,
    value: boolean | undefined,
  ) => void;
}

const CAPABILITY_LABELS: Record<string, string> = {
  tools: "Вызов функций",
  vision: "Изображения",
  fim: "Дополнение кода",
  classification: "Классификация",
  "fine-tuning": "Дообучение",
};

export function SettingsProviderMistralModelCard({
  model,
  enabled,
  onEnabledChange,
  onCapabilityOverride,
}: Props) {
  const details = model.details;
  const capabilities = (details.supportedParameters ?? [])
    .map((capability) => CAPABILITY_LABELS[capability])
    .filter(Boolean);
  const aliases = details.aliases ?? [];

  return (
    <article className="flex items-center gap-3 rounded-xl bg-main-700/20 p-3 transition-colors hover:bg-main-700/35 group/mistral-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-300 group-hover/mistral-card:hidden">
        <MistralIcon className="size-4" />
      </span>
      <span
        className="hidden cursor-pointer size-10 shrink-0 place-items-center rounded-xl bg-accent-medium text-main-900 group-hover/mistral-card:grid"
        onClick={() => {
          window.desktop.core.openExternalUrl(
            `https://docs.mistral.ai/models/${model.id}`,
          );
        }}
      >
        <OpenInNewIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-sm font-medium text-main-100">
            {model.name}
          </h4>
          {details.contextLength ? (
            <span className="shrink-0 rounded-full bg-main-700/60 px-2 py-0.5 text-[10px] text-main-400">
              {formatContext(details.contextLength)}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate font-mono text-[11px] text-main-500">
          {model.id}
        </p>
        {details.description ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-main-400">
            {details.description}
          </p>
        ) : null}
        {capabilities.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {capabilities.map((capability) => (
              <span
                key={capability}
                className="rounded-full bg-main-700/60 px-2 py-0.5 text-[10px] text-main-400"
              >
                {capability}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-main-500">
          {details.family ? <span>{details.family}</span> : null}
          {aliases.length ? (
            <span className="truncate">Алиасы: {aliases.join(", ")}</span>
          ) : null}
          {model.modifiedAt ? (
            <span>
              {new Date(model.modifiedAt).toLocaleDateString("ru-RU")}
            </span>
          ) : null}
        </div>
        <ModelCapabilityChips
          details={model.details}
          onOverride={onCapabilityOverride}
        />
      </div>
      <InputCheckSlided checked={enabled} onChange={onEnabledChange} />
    </article>
  );
}
