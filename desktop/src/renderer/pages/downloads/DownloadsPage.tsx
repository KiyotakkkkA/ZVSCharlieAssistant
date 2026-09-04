import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { ScrollArea, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { BasicAlert } from "@renderer/components/atoms/basic";
import { PageHeader } from "@renderer/components/organisms";
import { DownloadRow } from "@renderer/components/molecules";
import { downloadStore, vectorStoreStore } from "@renderer/stores";
import {
  explainCudaSupport,
  isDownloadNeededOnThisComputer,
} from "@renderer/lib/plain-language";
import {
  DOWNLOAD_CATEGORIES,
  DOWNLOAD_CATEGORY_LABELS,
} from "../../../shared/models/downloads";
import { formatBytes } from "@renderer/lib/format";

export const DownloadsPage = observer(function DownloadsPage() {
  const toasts = useToasts();

  useEffect(() => {
    void downloadStore.bootstrap();
    void vectorStoreStore.bootstrap();
  }, []);

  const cudaSupport = explainCudaSupport(vectorStoreStore.capabilities);
  const pending = downloadStore.pending.filter((item) =>
    isDownloadNeededOnThisComputer(item.id, vectorStoreStore.capabilities),
  );
  const pendingBytes = pending.reduce(
    (sum, item) => sum + item.downloadBytes,
    0,
  );

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <PageHeader
        title="Загрузки"
        description="Модели и библиотеки, которые программа скачивает один раз и хранит на этом компьютере."
        breadcrumbs={[{ label: "Загрузки" }]}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-1 pb-5">
          {pending.length ? (
            <BasicAlert variant="info" title="Не всё загружено">
              Осталось скачать {formatBytes(pendingBytes)}.
            </BasicAlert>
          ) : (
            <BasicAlert variant="success" title="Всё загружено">
              Все нужные файлы уже на вашем компьютере.
            </BasicAlert>
          )}

          {DOWNLOAD_CATEGORIES.map((category) => {
            const items = downloadStore.byCategory(category);
            if (!items.length) return null;
            return (
              <section key={category} className="space-y-3">
                <h2 className="text-sm font-semibold text-main-200">
                  {DOWNLOAD_CATEGORY_LABELS[category]}
                </h2>
                <ul className="space-y-3">
                  {items.map((item) => (
                    <DownloadRow
                      key={item.id}
                      id={item.id}
                      warning={
                        item.id === "cuda" ? (cudaSupport?.text ?? null) : null
                      }
                      onError={(message) =>
                        toasts.danger({
                          title: "Не удалось выполнить действие",
                          description: message,
                        })
                      }
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
});
