import { useId, useState } from "react";
import { observer } from "mobx-react-lite";
import { Button, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { ChevronDownIcon } from "../atoms";
import type { IngestProgress, ResourceSample } from "../../../ipc/contracts";
import { formatDuration } from "@renderer/lib/format";

interface IndexingMonitorPanelProps {
  sample: ResourceSample | null;
  progress: IngestProgress | null;
  cancelling: boolean;
  onCancel: () => void;
  onResume: () => void;
}

export const IndexingMonitorPanel = observer(function IndexingMonitorPanel({
  sample,
  progress,
  cancelling,
  onCancel,
  onResume,
}: IndexingMonitorPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const detailsId = useId();
  const gpu = sample?.gpu ?? null;
  const done = progress ? progress.completed : 0;
  const total = progress?.total ?? 0;
  const percent = total ? Math.min(100, (done / total) * 100) : 0;

  return (
    <div className="rounded-xl bg-main-800/45 p-4 ring-1 ring-main-700/35">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-lg text-left transition-colors hover:text-main-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-medium/50"
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={`mt-0.5 size-4 shrink-0 text-main-500 transition-transform duration-300 ease-out ${
              expanded ? "rotate-180" : "rotate-0"
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-main-200">
              {progress?.paused
                ? "Индексация остановлена"
                : progress
                  ? "Идёт индексация"
                  : "Индексация не запущена"}
            </p>
            <p className="mt-1 text-xs tabular-nums text-main-400">
              {progress
                ? `${done} из ${total} · ${percent.toFixed(0)}% · в работе ${progress.active}${
                    progress.failed ? ` · ошибок ${progress.failed}` : ""
                  }`
                : "Показатели обновляются раз в секунду"}
            </p>
          </div>
        </button>
        {progress ? (
          <Button
            variant={progress.paused ? "primary" : "danger"}
            rounded="rounded-full"
            className="shrink-0 px-2"
            loading={cancelling}
            disabled={cancelling || progress.cancelling}
            onClick={progress.paused ? onResume : onCancel}
          >
            {progress.paused ? "Продолжить" : "Остановить"}
          </Button>
        ) : null}
      </div>

      <div
        aria-hidden="true"
        className={`overflow-hidden rounded-full bg-main-700/40 transition-[height,margin,opacity] duration-300 ease-out ${
          !expanded && progress ? "mt-3 h-1 opacity-100" : "mt-0 h-0 opacity-0"
        }`}
      >
        <div
          className="h-full rounded-full bg-accent-light transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div
        id={detailsId}
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
          expanded
            ? "mt-4 grid-rows-[1fr] opacity-100"
            : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4">
            {progress ? (
              <div className="space-y-2">
                <ProgressBar value={percent} label="Прогресс" showValue />
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums text-main-400">
                  <span>
                    Прошло: {formatDuration(Date.now() - progress.startedAt)}
                  </span>
                  <span>
                    Осталось:{" "}
                    {progress.etaMs === null
                      ? "оценивается…"
                      : formatDuration(progress.etaMs)}
                  </span>
                  <span>
                    На документ:{" "}
                    {progress.averageMs === null
                      ? "—"
                      : formatDuration(progress.averageMs)}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <Meter
                label="Процессор"
                value={sample ? `${sample.cpuPercent.toFixed(0)}%` : "—"}
                detail={sample ? `${sample.coreCount} потоков` : ""}
                percent={sample?.cpuPercent ?? null}
              />
              <Meter
                label="Память"
                value={
                  sample ? `${(sample.ramUsedMb / 1024).toFixed(1)} ГБ` : "—"
                }
                detail={
                  sample
                    ? `из ${(sample.ramTotalMb / 1024).toFixed(1)} ГБ · процесс ${sample.processRssMb} МБ`
                    : ""
                }
                percent={
                  sample && sample.ramTotalMb
                    ? (sample.ramUsedMb / sample.ramTotalMb) * 100
                    : null
                }
              />
              <Meter
                label="Видеокарта"
                value={
                  gpu?.available && gpu.utilizationPercent !== null
                    ? `${gpu.utilizationPercent}%`
                    : "—"
                }
                detail={
                  gpu?.available
                    ? [
                        gpu.memoryUsedMb !== null && gpu.memoryTotalMb !== null
                          ? `${(gpu.memoryUsedMb / 1024).toFixed(1)}/${(gpu.memoryTotalMb / 1024).toFixed(1)} ГБ`
                          : null,
                        gpu.temperatureCelsius !== null
                          ? `${gpu.temperatureCelsius} °C`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "GPU недоступен"
                }
                percent={gpu?.available ? gpu.utilizationPercent : null}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

interface MeterProps {
  label: string;
  value: string;
  detail: string;
  percent: number | null;
}

function resolvePercentColor(percent: number | null): string {
  if (percent === null) return "bg-main-700/40";
  if (percent < 50) return "bg-success-light";
  if (percent < 80) return "bg-warning-light";
  return "bg-danger-light";
}

function Meter({ label, value, detail, percent }: MeterProps) {
  return (
    <div className="rounded-lg bg-main-900/40 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-main-500">{label}</span>
        <span className="text-sm font-medium tabular-nums text-main-200">
          {value}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-main-700/40">
        <div
          className={`h-full rounded-full ${resolvePercentColor(percent)} transition-[width] duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
        />
      </div>
      {detail ? (
        <p className="mt-1.5 text-[11px] tabular-nums text-main-500">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
