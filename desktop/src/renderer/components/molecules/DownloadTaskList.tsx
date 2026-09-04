import { observer } from "mobx-react-lite";
import { Button, EmptyState, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { DownloadIcon } from "../atoms";
import { downloadStore } from "@renderer/stores";
import { formatBytes, formatDuration } from "@renderer/lib/format";
import { humanizeError } from "@renderer/lib/plain-language";

export const DownloadTaskList = observer(function DownloadTaskList() {
  const running = downloadStore.items.filter(
    (item) => item.startedAt !== null && item.state !== "installed",
  );
  const active = downloadStore.busy;

  if (!running.length && !active.length)
    return (
      <div className="grid min-h-80 place-items-center">
        <EmptyState
          icon={<DownloadIcon className="size-6" />}
          title="Загрузок пока не было"
          description="Здесь появятся текущие задачи по загрузке моделей и библиотек."
        />
      </div>
    );

  return (
    <ul className="space-y-3 p-1">
      {running.map((item) => (
        <li
          key={item.id}
          className="rounded-xl bg-main-800/45 p-4 ring-1 ring-main-700/30"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-main-100">{item.label}</p>
              <p className="mt-1 text-xs tabular-nums text-main-500">
                {item.startedAt
                  ? `Идёт ${formatDuration(Date.now() - item.startedAt)}`
                  : "В очереди"}
                {item.activeComponent ? ` · ${item.activeComponent}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs tabular-nums text-main-500">
                {formatBytes(item.receivedBytes)} /{" "}
                {formatBytes(item.totalBytes ?? item.downloadBytes)}
              </span>
              {item.state === "queued" ||
              item.state === "downloading" ||
              item.state === "unpacking" ? (
                <Button
                  variant="danger"
                  rounded="rounded-full"
                  className="px-2"
                  onClick={() => void downloadStore.cancel(item.id)}
                >
                  Отменить
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={item.percent ?? 0} max={100} showValue />
          </div>
          {item.error ? (
            <p className="mt-2 text-xs text-danger-light">
              {humanizeError(item.error)}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
});
