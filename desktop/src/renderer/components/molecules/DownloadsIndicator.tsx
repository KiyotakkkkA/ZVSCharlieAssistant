import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Button, Floating, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { useNavigate } from "react-router-dom";
import { DownloadIcon } from "../atoms";
import { downloadStore } from "@renderer/stores";
import { APP_PATHS } from "@renderer/app/routes";
import { formatBytes } from "@renderer/lib/format";
import { humanizeError } from "@renderer/lib/plain-language";

export const DownloadsIndicator = observer(function DownloadsIndicator() {
  const navigate = useNavigate();

  useEffect(() => {
    void downloadStore.bootstrap();
  }, []);

  const busy = downloadStore.busy;
  const failed = downloadStore.failed;
  const pending = downloadStore.pending;
  const percent = downloadStore.overallPercent;

  return (
    <Floating anchor="bottom-right">
      <Floating.Trigger>
        <Button
          data-tour="header-downloads"
          variant="ghost"
          title="Загрузки"
          className="relative size-9 p-0 text-main-400 hover:bg-main-700/70 hover:text-main-50"
          onClick={() => navigate(APP_PATHS.downloads)}
        >
          <DownloadIcon className="size-5" />
          {busy.length ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-accent-light" />
          ) : failed.length ? (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-danger-light" />
          ) : null}
        </Button>
      </Floating.Trigger>
      <Floating.Content rounded="rounded-3xl">
        <div className="w-80 space-y-3 p-3">
          <p className="text-sm font-medium text-main-200">Загрузки</p>

          {busy.length ? (
            <div className="space-y-3">
              {busy.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-main-300">
                      {item.label}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-main-500">
                      {formatBytes(item.receivedBytes)} /{" "}
                      {formatBytes(item.totalBytes ?? item.downloadBytes)}
                    </span>
                  </div>
                  <ProgressBar value={item.percent ?? 0} max={100} showValue />
                </div>
              ))}
              {percent !== null && busy.length > 1 ? (
                <p className="text-[11px] tabular-nums text-main-500">
                  Всего: {percent}%
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs leading-5 text-main-500">
              Сейчас ничего не загружается.
            </p>
          )}

          {failed.length ? (
            <div className="space-y-1 border-t border-main-700/35 pt-2">
              {failed.map((item) => (
                <p key={item.id} className="text-[11px] text-danger-light">
                  {item.label}: {humanizeError(item.error)}
                </p>
              ))}
            </div>
          ) : null}

          {pending.length ? (
            <p className="border-t border-main-700/35 pt-2 text-[11px] text-main-500">
              Не загружено: {pending.length} · осталось{" "}
              {formatBytes(downloadStore.pendingBytes)}
            </p>
          ) : null}
        </div>
      </Floating.Content>
    </Floating>
  );
});
