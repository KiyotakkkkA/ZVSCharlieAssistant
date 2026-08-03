import { InputCheckSlided } from "@kiyotakkkka/zvs-uikit-lib";
import type { TextProviderModelInfo } from "../../../ipc/contracts";
import { RobotIcon } from "../atoms";

interface Props {
  model: TextProviderModelInfo;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes <= 0) return "Размер не указан";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ${units[index]}`;
};

export function SettingsProviderOllamaModelCard({
  model,
  enabled,
  onEnabledChange,
}: Props) {
  const detail = [
    model.details.parameterSize,
    model.details.quantizationLevel,
    model.details.family,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="flex items-center gap-3 rounded-xl bg-main-700/20 p-3 transition-colors hover:bg-main-700/35">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-300">
        <RobotIcon className="size-4" />
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
      </div>
      <InputCheckSlided checked={enabled} onChange={onEnabledChange} />
    </article>
  );
}
