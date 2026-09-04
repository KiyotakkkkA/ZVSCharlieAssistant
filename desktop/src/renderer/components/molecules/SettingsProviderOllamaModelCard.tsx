import { InputCheckSlided } from "@kiyotakkkka/zvs-uikit-lib";
import type { TextProviderModelInfo } from "../../../shared/models/text-provider";
import { OllamaIcon, OpenInNewIcon } from "../atoms";
import { formatSize } from "@renderer/lib/format";
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

export function SettingsProviderOllamaModelCard({
  model,
  enabled,
  onEnabledChange,
  onCapabilityOverride,
}: Props) {
  const detail = [
    model.details.parameterSize,
    model.details.quantizationLevel,
    model.details.family,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="flex items-center gap-3 rounded-xl bg-main-700/20 p-3 transition-colors hover:bg-main-700/35 group/ollama-card">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-300 group-hover/ollama-card:hidden">
        <OllamaIcon className="size-4 group-hover/ollama-card:hidden" />
      </span>
      <span
        className="hidden cursor-pointer size-10 shrink-0 place-items-center rounded-xl bg-accent-medium text-main-900 group-hover/ollama-card:grid"
        onClick={() => {
          window.desktop.core.openExternalUrl(
            `https://ollama.com/library/${model.id}`,
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
          {detail ? (
            <span className="shrink-0 rounded-full bg-main-700/60 px-2 py-0.5 text-[10px] text-main-400">
              {detail}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate font-mono text-[11px] text-main-500">
          {model.id}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-main-500">
          <span>{formatSize(model.size)}</span>
          {model.digest ? (
            <span>digest: {model.digest.slice(0, 12)}</span>
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
