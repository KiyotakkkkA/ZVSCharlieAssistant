import { ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { FileIcon } from "@renderer/components/atoms";
import { ControlButton } from "@renderer/components/atoms/basic";
import type { VectorDocument, VectorStoreModel } from "@renderer/stores";
import { formatBytes } from "@renderer/lib/format";

export const DOCUMENT_ROW_HEIGHT = 80;
export const DOCUMENT_ROW_GAP = 8;

export function DocumentRow({
  document,
  onDelete,
}: {
  document: VectorDocument;
  onDelete: () => void;
}) {
  return (
    <div
      style={{ height: DOCUMENT_ROW_HEIGHT - DOCUMENT_ROW_GAP }}
      className="flex items-center gap-3 overflow-hidden rounded-xl bg-main-800/45 p-3 ring-1 ring-main-700/30"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-main-700/45 text-main-300">
        <FileIcon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-main-100">
            {document.fileName}
          </span>
          <span className="text-[11px] text-main-500">
            {formatBytes(document.size)} · {document.chunkCount} чанков
          </span>
        </div>
        {document.status === "ready" ? (
          <p className="mt-1 text-xs text-success-light">Готов к поиску</p>
        ) : document.status === "failed" ? (
          <div className="mt-1">
            <p className="text-xs font-medium text-danger-light">
              Ошибка обработки
            </p>
            {document.errorMessage ? (
              <p className="mt-1 line-clamp-1 text-xs leading-5 text-main-500">
                {document.errorMessage}
              </p>
            ) : null}
          </div>
        ) : (
          <ProgressBar
            className="mt-2"
            value={document.progress}
            max={100}
            label={documentStatusLabel(document.status)}
            showValue
          />
        )}
      </div>
      <ControlButton
        icon="trash"
        variant="delete"
        title="Удалить документ"
        onClick={onDelete}
      />
    </div>
  );
}

export function StorageSummary({
  model,
  documents,
  backgroundIndexing,
}: {
  model: VectorStoreModel;
  documents: VectorDocument[];
  backgroundIndexing: boolean;
}) {
  const totalBytes = documents.reduce(
    (sum, document) => sum + document.size,
    0,
  );
  const totalChunks = documents.reduce(
    (sum, document) => sum + document.chunkCount,
    0,
  );
  const readyDocuments = documents.filter(
    (document) => document.status === "ready",
  ).length;
  const failedDocuments = documents.filter(
    (document) => document.status === "failed",
  ).length;
  const processingDocuments =
    documents.length - readyDocuments - failedDocuments;
  const folderPaths = collectFolderPaths(documents);
  const topLevelFolders = [
    ...new Set([...folderPaths].map((folderPath) => folderPath.split("/")[0]!)),
  ];
  const status = storageStatus(backgroundIndexing ? "indexing" : model.status);

  return (
    <section className="rounded-2xl bg-main-800/45 p-4 ring-1 ring-main-700/35">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-main-100">
              Состояние хранилища
            </h3>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}
            >
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-main-500">{status.description}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <SummaryMetric
          label="Размер документов"
          value={formatBytes(totalBytes)}
        />
        <SummaryMetric
          label="Документы"
          value={`${readyDocuments} из ${documents.length}`}
          hint={
            failedDocuments
              ? `Ошибок: ${failedDocuments}`
              : processingDocuments
                ? `В обработке: ${processingDocuments}`
                : "Готовы к поиску"
          }
        />
        <SummaryMetric
          label="Папки"
          value={String(folderPaths.size)}
          hint={
            topLevelFolders.length
              ? topLevelFolders.slice(0, 3).join(", ")
              : "Файлы в корне"
          }
        />
        <SummaryMetric label="Фрагменты" value={String(totalChunks)} />
      </dl>
    </section>
  );
}

export function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-main-900/25 p-3">
      <dt className="text-[11px] text-main-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-main-100">
        {value}
      </dd>
      {hint ? (
        <p className="mt-1 truncate text-[11px] text-main-500" title={hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function storageStatus(status: VectorStoreModel["status"]) {
  if (status === "indexing")
    return {
      label: "Индексация",
      description: "Фоновые задачи обрабатывают документы.",
      className: "bg-warning-medium/10 text-warning-light",
    };
  if (status === "ready")
    return {
      label: "Готово",
      description: "Хранилище настроено и доступно для поиска.",
      className: "bg-success-medium/10 text-success-light",
    };
  if (status === "degraded")
    return {
      label: "Есть ошибки",
      description: "Часть документов не удалось обработать.",
      className: "bg-danger-medium/10 text-danger-light",
    };
  return {
    label: "Не настроено",
    description: "Выберите embedding-модель перед загрузкой документов.",
    className: "bg-main-700/60 text-main-400",
  };
}

export function collectFolderPaths(documents: VectorDocument[]) {
  const folders = new Set<string>();
  for (const document of documents) {
    const parts = document.fileName.replaceAll("\\", "/").split("/");
    for (let index = 1; index < parts.length; index += 1)
      folders.add(parts.slice(0, index).join("/"));
  }
  return folders;
}

export function documentStatusLabel(status: VectorDocument["status"]) {
  if (status === "extracting") return "Извлечение текста";
  if (status === "embedding") return "Векторизация";
  return "Ожидает обработки";
}
