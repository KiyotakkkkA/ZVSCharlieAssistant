import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputDropZone,
  InputSmall,
  ScrollArea,
  Switcher,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import {
  FileDocumentMultipleIcon,
  RefreshIcon,
  SearchIcon,
} from "@renderer/components/atoms";
import { IndexingMonitorPanel } from "@renderer/components/molecules";
import { DangerModal } from "@renderer/components/organisms/modals";
import {
  vectorStoreStore,
  type VectorDocument,
  type VectorStoreModel,
} from "@renderer/stores";
import { humanizeError } from "@renderer/lib/plain-language";
import {
  DOCUMENT_ROW_HEIGHT,
  DocumentRow,
  StorageSummary,
} from "./VecdbDocumentPieces";
import { useVirtualRows } from "@renderer/hooks";

type DocumentFilter = "all" | "ready" | "failed";

const DOCUMENT_FILTERS: { value: DocumentFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "ready", label: "Успешные" },
  { value: "failed", label: "С ошибками" },
];

interface VecdbDocumentsTabProps {
  model: VectorStoreModel;
  backgroundIndexing: boolean;
  directoryIndexing: boolean;
  onOpenMultipleIndex: () => void;
}

export const VecdbDocumentsTab = observer(function VecdbDocumentsTab({
  model,
  backgroundIndexing,
  onOpenMultipleIndex,
}: VecdbDocumentsTabProps) {
  const toasts = useToasts();
  const [documentQuery, setDocumentQuery] = useState("");
  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>("all");
  const [retrying, setRetrying] = useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<VectorDocument | null>(null);
  const documents = vectorStoreStore.documentsFor(model.id);
  const failedDocuments = documents.filter(
    (document) => document.status === "failed",
  );
  const readyDocuments = documents.filter(
    (document) => document.status === "ready",
  );
  const normalizedDocumentQuery = documentQuery.trim().toLocaleLowerCase();
  const filteredDocuments =
    documentFilter === "ready"
      ? readyDocuments
      : documentFilter === "failed"
        ? failedDocuments
        : documents;
  const visibleDocuments = normalizedDocumentQuery
    ? filteredDocuments.filter((document) =>
        document.fileName.toLocaleLowerCase().includes(normalizedDocumentQuery),
      )
    : filteredDocuments;
  const rows = useVirtualRows(visibleDocuments.length, DOCUMENT_ROW_HEIGHT);
  const monitorVisible = Boolean(
    backgroundIndexing || vectorStoreStore.ingestProgress,
  );

  return (
    <>
      <div
        data-tour="knowledge-documents"
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="space-y-4 p-5 pb-4">
          <div className="flex justify-end gap-2">
            {failedDocuments.length ? (
              <Button
                variant="secondary"
                rounded="rounded-full"
                disabled={backgroundIndexing || retrying}
                loading={retrying}
                className="px-2"
                onClick={() => {
                  setRetrying(true);
                  void vectorStoreStore
                    .retryFailedDocuments(model.id)
                    .then(() =>
                      toasts.success({
                        title: "Повторная обработка запущена",
                        description: `Документов в очереди: ${failedDocuments.length}.`,
                      }),
                    )
                    .catch((error) =>
                      toasts.danger({
                        title: "Не удалось перезапустить обработку",
                        description: humanizeError(error),
                      }),
                    )
                    .finally(() => setRetrying(false));
                }}
              >
                <RefreshIcon className="size-4" />
                Повторить неудачные ({failedDocuments.length})
              </Button>
            ) : null}
            <Button
              variant="secondary"
              rounded="rounded-full"
              disabled={backgroundIndexing}
              className="px-2"
              onClick={onOpenMultipleIndex}
            >
              <FileDocumentMultipleIcon className="size-4" />
              Множественная загрузка
            </Button>
          </div>
          <div
            className={`mt-0! grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              monitorVisible
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden pt-4">
              <IndexingMonitorPanel
                sample={vectorStoreStore.resourceSample}
                progress={vectorStoreStore.ingestProgress}
                cancelling={vectorStoreStore.cancelling}
                onCancel={() => {
                  void vectorStoreStore
                    .stopIndexing()
                    .then(() =>
                      toasts.success({
                        title: "Индексация остановлена",
                        description:
                          "Все очереди остановлены. Нажмите «Продолжить», чтобы возобновить обработку.",
                      }),
                    )
                    .catch((error) =>
                      toasts.danger({
                        title: "Не удалось отменить обработку",
                        description: humanizeError(error),
                      }),
                    );
                }}
                onResume={() => {
                  void vectorStoreStore
                    .resumeIndexing()
                    .then(() =>
                      toasts.success({ title: "Индексация продолжена" }),
                    )
                    .catch((error) =>
                      toasts.danger({
                        title: "Не удалось продолжить индексацию",
                        description: humanizeError(error),
                      }),
                    );
                }}
              />
            </div>
          </div>
          <StorageSummary
            model={model}
            documents={documents}
            backgroundIndexing={backgroundIndexing}
          />
          <InputDropZone
            files={[]}
            multiple
            accept=".pdf,.docx,.txt"
            emptyTitle="Перетащите документы или выберите файлы"
            emptyDescription="PDF, DOCX и TXT"
            selectedMultipleDescription="Добавьте ещё документы"
            clearAllLabel="Очистить список"
            uploadedFileLabel="Документ"
            onFilesChange={(files) => {
              if (files.length)
                void vectorStoreStore
                  .addFiles(model.id, files)
                  .then(() =>
                    toasts.success({
                      title: "Документы обработаны",
                      description: "Индекс готов к векторному поиску.",
                    }),
                  )
                  .catch((error) =>
                    toasts.danger({
                      title: "Не удалось добавить документы",
                      description: humanizeError(error),
                    }),
                  );
            }}
          />
          {documents.length ? (
            <div className="flex flex-wrap items-center gap-3">
              <Switcher
                value={documentFilter}
                onChange={(value) => setDocumentFilter(value as DocumentFilter)}
                options={DOCUMENT_FILTERS}
                label="Фильтр документов"
              />
              <InputSmall
                preset="search"
                value={documentQuery}
                placeholder="Найти документ по названию..."
                className="w-full max-w-xl"
                onChange={(event) => setDocumentQuery(event.target.value)}
                onClear={() => setDocumentQuery("")}
              />
              {documentQuery.trim() || documentFilter !== "all" ? (
                <span className="shrink-0 text-xs tabular-nums text-main-500">
                  Найдено: {visibleDocuments.length}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {documents.length ? (
          <ScrollArea
            ref={rows.containerRef}
            onScroll={rows.onScroll}
            className="min-h-0 flex-1"
          >
            <div className="space-y-2 px-5 pb-5">
              {visibleDocuments.length ? (
                <div
                  style={{
                    paddingTop: rows.paddingTop,
                    paddingBottom: rows.paddingBottom,
                  }}
                  className="space-y-2"
                >
                  {visibleDocuments
                    .slice(rows.start, rows.end)
                    .map((document) => (
                      <DocumentRow
                        key={document.id}
                        document={document}
                        onDelete={() => setDocumentToDelete(document)}
                      />
                    ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-main-700 px-4 py-8 text-center">
                  <SearchIcon className="mx-auto size-5 text-main-500" />
                  <p className="mt-2 text-sm text-main-300">
                    Документы не найдены
                  </p>
                  <p className="mt-1 text-xs text-main-500">
                    {documentFilter === "ready"
                      ? "Ни один документ ещё не обработан успешно."
                      : documentFilter === "failed"
                        ? "Документов с ошибками нет."
                        : "Измените поисковый запрос."}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : null}
      </div>
      <DangerModal
        open={documentToDelete !== null}
        model={documentToDelete}
        title="Удалить документ?"
        description={(item) => (
          <>
            Документ «
            <strong className="font-semibold text-main-50">
              {item.fileName}
            </strong>
            » и все его чанки будут удалены.
          </>
        )}
        onCancel={() => setDocumentToDelete(null)}
        onConfirm={(item) => {
          setDocumentToDelete(null);
          void vectorStoreStore
            .deleteDocument(item.id)
            .then(() => toasts.success({ title: "Документ удалён" }))
            .catch((error) =>
              toasts.danger({
                title: "Не удалось удалить документ",
                description: humanizeError(error),
              }),
            );
        }}
      />
    </>
  );
});
