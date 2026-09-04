import type { TextProviderModelDetails } from "../../../shared/dto";
import {
  MODEL_CAPABILITY_HINTS,
  MODEL_CAPABILITY_KEYS,
  MODEL_CAPABILITY_LABELS,
  resolveModelCapabilities,
  type ModelCapabilityKey,
} from "../../../shared/models/model-capabilities";

interface Props {
  details: Partial<TextProviderModelDetails>;
  onOverride?: (key: ModelCapabilityKey, value: boolean | undefined) => void;
}

const STATE_STYLES = {
  yes: "bg-accent-medium/15 text-accent-light ring-accent-light/30",
  no: "bg-main-700/40 text-main-500 ring-main-600/30 line-through",
  unknown: "bg-main-700/25 text-main-400 ring-main-600/25 border-dashed",
} as const;

const next = (value: boolean | undefined): boolean | undefined =>
  value === undefined ? true : value ? false : undefined;

const describe = (value: boolean | undefined) =>
  value === undefined ? "не определено" : value ? "поддерживается" : "нет";

export function ModelCapabilityChips({ details, onOverride }: Props) {
  const capabilities = resolveModelCapabilities(details);

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {MODEL_CAPABILITY_KEYS.map((key) => {
        const value = capabilities[key];
        const overridden = details[key] !== undefined;
        const state = value === undefined ? "unknown" : value ? "yes" : "no";
        return (
          <button
            key={key}
            type="button"
            disabled={!onOverride}
            title={`${MODEL_CAPABILITY_HINTS[key]} — ${describe(value)}${
              overridden ? " (задано вручную)" : ""
            }${onOverride ? ". Нажмите, чтобы изменить" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onOverride?.(key, next(details[key]));
            }}
            className={`rounded-full px-2 py-0.5 text-[10px] ring-1 ${STATE_STYLES[state]} ${
              onOverride ? "cursor-pointer" : "cursor-default"
            } ${overridden ? "font-medium" : ""}`}
          >
            {MODEL_CAPABILITY_LABELS[key]}
            {overridden ? " ✎" : ""}
          </button>
        );
      })}
    </div>
  );
}
