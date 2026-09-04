import { observer } from "mobx-react-lite";
import { Button, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import type { IngestProgress, ResourceSample } from "../../../ipc/contracts";

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
  const gpu = sample?.gpu ?? null;
  const done = progress ? progress.completed : 0;
  const total = progress?.total ?? 0;
  const percent = total ? Math.min(100, (done / total) * 100) : 0;

  return (
    <div className="space-y-4 rounded-xl bg-main-800/45 p-4 ring-1 ring-main-700/35">
      <div className="flex items-start justify-between gap-3">
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
              ? `${done} из ${total} · в работе ${progress.active}${
                  progress.failed ? ` · ошибок ${progress.failed}` : ""
                }`
              : "Показатели обновляются раз в секунду"}
          </p>
        </div>
        {progress ? (
          <Button
            variant="danger"
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
          value={sample ? `${(sample.ramUsedMb / 1024).toFixed(1)} ГБ` : "—"}
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
  );
});

interface MeterProps {
  label: string;
  value: string;
  detail: string;
  percent: number | null;
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
          className="h-full rounded-full bg-accent-light transition-[width] duration-500"
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

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин ${seconds % 60} с`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин`;
  return `${Math.floor(hours / 24)} д ${hours % 24} ч`;
}
