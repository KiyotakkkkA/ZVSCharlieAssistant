import { observer } from "mobx-react-lite";
import { Button, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { BasicAlert } from "@renderer/components/atoms/basic";
import {
  CheckIcon,
  DownloadIcon,
  FolderIcon,
  RefreshIcon,
  TrashIcon,
} from "../atoms";
import { useDownload } from "@renderer/hooks";
import { formatBytes } from "@renderer/lib/format";
import { humanizeError } from "@renderer/lib/plain-language";
import type { DownloadId } from "@ipc/contracts";

const STATE_LABELS: Record<string, string> = {
  absent: "не загружено",
  queued: "в очереди",
  downloading: "загружается",
  unpacking: "распаковывается",
  installed: "готово",
  failed: "ошибка",
  cancelled: "отменено",
};

interface DownloadRowProps {
  id: DownloadId;
  onError?: (message: string) => void;
  warning?: string | null;
}

export const DownloadRow = observer(function DownloadRow({
  id,
  onError,
  warning,
}: DownloadRowProps) {
  const {
    item,
    installed,
    busy,
    percent,
    error,
    start,
    cancel,
    remove,
    reveal,
  } = useDownload(id);

  const run = (action: () => Promise<void>) => {
    void action().catch((failure: unknown) =>
      onError?.(humanizeError(failure)),
    );
  };

  return (
    <li className="rounded-xl bg-main-800/45 p-4 ring-1 ring-main-700/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-main-700/45 text-main-300">
            {installed ? (
              <CheckIcon className="size-4 text-accent-light" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-main-100">
                {item.label}
              </span>
              <span className="text-[11px] text-main-500">
                {STATE_LABELS[item.state] ?? item.state}
              </span>
              {item.required && !installed ? (
                <span className="text-[11px] text-warning-light">
                  обязательно
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-main-500">
              {item.purpose}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs tabular-nums text-main-500">
            {installed
              ? formatBytes(item.sizeBytes)
              : formatBytes(item.downloadBytes)}
          </span>
          {busy ? (
            <Button
              variant="danger"
              rounded="rounded-full"
              className="px-2"
              onClick={() => run(cancel)}
            >
              Отменить
            </Button>
          ) : installed ? (
            <>
              <Button
                variant="secondary"
                className="px-2"
                onClick={() => reveal()}
              >
                <FolderIcon className="size-4" />
                Папка
              </Button>
              <Button
                variant="danger"
                className="px-2"
                onClick={() => run(remove)}
              >
                <TrashIcon className="size-4" />
                Удалить
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              className="px-2"
              onClick={() => run(start)}
            >
              {item.state === "failed" || item.state === "cancelled" ? (
                <RefreshIcon className="size-4" />
              ) : (
                <DownloadIcon className="size-4" />
              )}
              {item.state === "failed" || item.state === "cancelled"
                ? "Повторить"
                : "Загрузить"}
            </Button>
          )}
        </div>
      </div>

      {busy ? (
        <div className="mt-3">
          <ProgressBar
            value={percent ?? 0}
            max={100}
            showValue
            label={
              item.activeComponent
                ? `${formatBytes(item.receivedBytes)} из ${formatBytes(item.totalBytes)}`
                : "Подготовка"
            }
          />
        </div>
      ) : null}

      {warning && !installed && !busy ? (
        <BasicAlert variant="info" title="Эти файлы вам не понадобятся" className="mt-3">
          {warning}
        </BasicAlert>
      ) : null}

      {error && !busy ? (
        <BasicAlert variant="warning" title="Не удалось загрузить" className="mt-3">
          {humanizeError(error)}
        </BasicAlert>
      ) : null}
    </li>
  );
});
