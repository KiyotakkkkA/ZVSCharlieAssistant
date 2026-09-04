import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  ScrollArea,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { CheckIcon, DownloadIcon, Lead } from "@renderer/components/atoms";
import { vectorStoreStore } from "@renderer/stores";
import { useAppNavigation, useDownloads } from "@renderer/hooks";
import { APP_PATHS } from "@renderer/app/routes";
import type { OcrProviderPreference } from "@ipc/contracts";
import {
  explainCudaSupport,
  explainProvider,
  humanizeError,
  isDownloadNeededOnThisComputer,
  PROVIDER_CHOICES,
} from "@renderer/lib/plain-language";
import { formatBytes } from "@renderer/lib/format";

export const VecdbProviderTab = observer(function VecdbProviderTab() {
  const toasts = useToasts();
  const { goTo } = useAppNavigation();
  const [switching, setSwitching] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const capabilities = vectorStoreStore.capabilities;
  const status = explainProvider(capabilities);
  const cudaSupport = explainCudaSupport(capabilities);
  const downloads = useDownloads();
  const missing = downloads.filter(
    (item) =>
      !item.installed && isDownloadNeededOnThisComputer(item.id, capabilities),
  );

  const choose = (preference: OcrProviderPreference) => {
    setSwitching(true);
    void vectorStoreStore
      .setOcrProvider(preference)
      .catch((error: unknown) =>
        toasts.danger({
          title: "Не удалось изменить способ обработки",
          description: humanizeError(error),
        }),
      )
      .finally(() => setSwitching(false));
  };

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-5 p-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <Lead
          title="Способ обработки"
          description="Чем считать распознавание отсканированных страниц."
        />
        <div className="grid gap-3 rounded-xl bg-main-800/35 p-4">
          {PROVIDER_CHOICES.map((choice) => {
            const active = capabilities?.preference === choice.value;
            const unusable =
              choice.value === "cuda" &&
              capabilities?.cudaKernelsAvailable === false;
            return (
              <button
                key={choice.value}
                type="button"
                disabled={
                  switching || unusable || !capabilities?.addonAvailable
                }
                onClick={() => choose(choice.value)}
                className={`disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? "rounded-lg bg-accent-medium/10 p-3 text-left ring-1 ring-accent-light/40"
                    : "rounded-lg bg-main-900/40 p-3 text-left ring-1 ring-main-700/35 transition-colors hover:bg-main-900/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-main-100">
                    {choice.label}
                  </span>
                  {active ? (
                    <CheckIcon className="size-4 shrink-0 text-accent-light" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-main-500">
                  {unusable
                    ? "Не подходит этой видеокарте — она новее, чем поддерживает CUDA."
                    : choice.hint}
                </p>
              </button>
            );
          })}
          {capabilities?.deviceName ? (
            <p className="text-xs text-main-500">
              Найдена видеокарта: {capabilities.deviceName}
              {capabilities.computeCapability
                ? ` · ${capabilities.computeCapability}`
                : ""}
            </p>
          ) : null}
          {cudaSupport ? (
            <Alert variant="info" title={cudaSupport.title}>
              {cudaSupport.text}
            </Alert>
          ) : null}
          {status ? (
            <Alert
              variant={capabilities?.ocrAccelerated ? "info" : "warning"}
              title={status.title}
            >
              {status.text}
              {status.details ? (
                <>
                  <button
                    type="button"
                    className="mt-2 block text-xs text-main-500 underline"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails
                      ? "Скрыть подробности"
                      : "Подробности для ИТ-специалиста"}
                  </button>
                  {showDetails ? (
                    <p className="mt-1 break-all font-mono text-[11px] text-main-500">
                      {status.details}
                    </p>
                  ) : null}
                </>
              ) : null}
            </Alert>
          ) : null}
        </div>

        <Lead
          title="Нужные файлы"
          description="Модели и библиотеки, которые программа скачивает один раз."
        />
        <div className="grid gap-3 rounded-xl bg-main-800/35 p-4">
          <ul className="grid gap-2">
            {downloads.map((item) => {
              const needed = isDownloadNeededOnThisComputer(
                item.id,
                capabilities,
              );

              if (!needed) return null;

              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-main-900/40 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {item.installed || !needed ? (
                      <CheckIcon className="size-3.5 shrink-0 text-accent-light" />
                    ) : (
                      <DownloadIcon className="size-3.5 shrink-0 text-main-500" />
                    )}
                    <span className="truncate text-sm text-main-200">
                      {item.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-main-500">
                    {item.installed
                      ? formatBytes(item.sizeBytes)
                      : formatBytes(item.downloadBytes)}
                  </span>
                </li>
              );
            })}
          </ul>
          {missing.length ? (
            <Alert variant="warning" title="Не всё загружено">
              Осталось скачать{" "}
              {formatBytes(
                missing.reduce((sum, item) => sum + item.downloadBytes, 0),
              )}
              . Скачайте необходиые файлы со страницы «Загрузки».
            </Alert>
          ) : null}
          <div>
            <Button
              variant="secondary"
              className="px-2"
              onClick={() => goTo(APP_PATHS.downloads)}
            >
              <DownloadIcon className="size-4" />
              Открыть «Загрузки»
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
});
