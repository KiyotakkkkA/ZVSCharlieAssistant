import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  InputBig,
  InputDropZone,
  InputSmall,
  ProgressBar,
  ScrollArea,
  Select,
  Tabs,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import {
  Field,
  FileIcon,
  FileDocumentMultipleIcon,
  Lead,
  ParameterLabel,
  SearchIcon,
  StorageIcon,
  TrashIcon,
} from "../../../atoms";
import { ControlButton } from "../../../atoms/buttons";
import { DangerModal } from "../../modals";
import {
  textProviderStore,
  vectorStoreStore,
  type VectorDocument,
  type VectorStoreModel,
} from "../../../../stores";
import type { VectorSearchResultItem } from "../../../../../ipc/contracts";
import { ProvidedEntityManageHeader } from "@renderer/components/molecules";
import { StorageVecdbMultipleIndexForm } from "./StorageVecdbMultipleIndexForm";

type DetailTab = "documents" | "settings" | "search";
interface StorageVecdbManageFormProps {
  model: VectorStoreModel;
}

export const StorageVecdbManageForm = observer(function StorageVecdbManageForm({
  model,
}: StorageVecdbManageFormProps) {
  const toasts = useToasts();
  const [tab, setTab] = useState<DetailTab>("documents");
  const [query, setQuery] = useState("");
  const [documentQuery, setDocumentQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [multipleIndexOpen, setMultipleIndexOpen] = useState(false);
  const [directoryIndexing, setDirectoryIndexing] = useState(false);
  const [results, setResults] = useState<VectorSearchResultItem[]>([]);
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description);
  const [embeddingModelId, setEmbeddingModelId] = useState(
    model.embeddingModelId ? String(model.embeddingModelId) : "",
  );
  const [searchMode, setSearchMode] = useState(model.searchMode);
  const [chunkSize, setChunkSize] = useState(String(model.chunkSizeTokens));
  const [chunkOverlap, setChunkOverlap] = useState(
    String(model.chunkOverlapTokens),
  );
  const [documentToDelete, setDocumentToDelete] =
    useState<VectorDocument | null>(null);
  const documents = vectorStoreStore.documentsFor(model.id);
  const normalizedDocumentQuery = documentQuery.trim().toLocaleLowerCase();
  const visibleDocuments = normalizedDocumentQuery
    ? documents.filter((document) =>
        document.fileName.toLocaleLowerCase().includes(normalizedDocumentQuery),
      )
    : documents;
  const directoryBatchDocuments = vectorStoreStore.activeDirectoryDocuments(
    model.id,
  );
  const processingDocuments = vectorStoreStore.processingDocuments(model.id);
  const visibleBackgroundDocuments = directoryBatchDocuments.length
    ? directoryBatchDocuments
    : processingDocuments;
  const completedDirectoryDocuments = visibleBackgroundDocuments.filter(
    (document) => ["ready", "failed"].includes(document.status),
  ).length;
  const backgroundIndexing =
    directoryIndexing ||
    model.status === "indexing" ||
    processingDocuments.length > 0;
  const directoryProgress = visibleBackgroundDocuments.length
    ? Math.round(
        visibleBackgroundDocuments.reduce(
          (sum, document) => sum + document.progress,
          0,
        ) / visibleBackgroundDocuments.length,
      )
    : directoryIndexing
      ? 2
      : 0;
  const embeddingModels = useMemo(
    () =>
      textProviderStore.models.filter((item) => {
        const provider = textProviderStore.providers.find(
          (entry) => entry.id === item.providerId,
        );
        return (
          item.enabled &&
          provider?.enabled &&
          provider.providerType === "embedding"
        );
      }),
    [textProviderStore.models, textProviderStore.providers],
  );
  const parsedChunkSize = Number(chunkSize);
  const parsedChunkOverlap = Number(chunkOverlap);
  const valid =
    name.trim().length > 0 &&
    Number.isInteger(parsedChunkSize) &&
    parsedChunkSize >= 100 &&
    parsedChunkSize <= 4096 &&
    Number.isInteger(parsedChunkOverlap) &&
    parsedChunkOverlap >= 0 &&
    parsedChunkOverlap <= parsedChunkSize / 2;
  const dirty =
    name.trim() !== model.name ||
    description !== model.description ||
    embeddingModelId !== (model.embeddingModelId ?? "") ||
    searchMode !== model.searchMode ||
    parsedChunkSize !== model.chunkSizeTokens ||
    parsedChunkOverlap !== model.chunkOverlapTokens;
  const save = async () => {
    if (!valid || !dirty) return;
    setSaving(true);
    try {
      const normalizedName = name.trim();
      await vectorStoreStore.updateStore(model.id, {
        name: normalizedName,
        description,
        embeddingModelId: embeddingModelId || null,
        searchMode,
        chunkSizeTokens: parsedChunkSize,
        chunkOverlapTokens: parsedChunkOverlap,
      });
      setName(normalizedName);
      toasts.success({
        title: "Настройки сохранены",
        description: "Векторное хранилище обновлено.",
      });
    } catch (error) {
      toasts.danger({
        title: "Не удалось сохранить",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <div data-tour="knowledge-form" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pt-5">
        <ProvidedEntityManageHeader
          model={{
            ...model,
            name: name.trim() || model.name,
            kind: "vecstore",
          }}
          description={description || "Описание не задано"}
          onSave={save}
          canSave={valid && dirty}
          saving={saving}
          actions={
            <Button
              variant="danger"
              rounded="rounded-full"
              className="px-3"
              disabled={!documents.length || backgroundIndexing}
              onClick={() => setClearModalOpen(true)}
            >
              <TrashIcon className="size-4" />
              Очистить хранилище
            </Button>
          }
        />
        <div data-tour="knowledge-tabs">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value as DetailTab)}
            options={[
              { value: "documents", label: `Документы · ${documents.length}` },
              { value: "settings", label: "Настройки" },
              { value: "search", label: "Тест поиска" },
            ]}
          />
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {tab === "documents" ? (
          <div data-tour="knowledge-documents" className="space-y-4 p-5">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                rounded="rounded-full"
                disabled={backgroundIndexing}
                className="px-2"
                onClick={() => setMultipleIndexOpen(true)}
              >
                <FileDocumentMultipleIcon className="size-4" />
                Множественная загрузка
              </Button>
            </div>
            <StorageSummary
              model={model}
              documents={documents}
              embeddingModelLabel={
                model.embeddingModelId
                  ? textProviderStore.modelLabel(model.embeddingModelId)
                  : "Не выбрана"
              }
              backgroundIndexing={backgroundIndexing}
              progress={directoryProgress}
              progressLabel={
                visibleBackgroundDocuments.length
                  ? directoryBatchDocuments.length
                    ? `Фоновая индексация · ${completedDirectoryDocuments} из ${visibleBackgroundDocuments.length}`
                    : `Фоновая индексация · ${processingDocuments.length} в обработке`
                  : "Подготовка файлов к индексации"
              }
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
                        description:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      }),
                    );
              }}
            />
            {documents.length ? (
              <div className="flex items-center gap-3">
                <InputSmall
                  preset="search"
                  value={documentQuery}
                  placeholder="Найти документ по названию..."
                  className="w-full max-w-xl"
                  onChange={(event) => setDocumentQuery(event.target.value)}
                />
                {documentQuery.trim() ? (
                  <span className="shrink-0 text-xs tabular-nums text-main-500">
                    Найдено: {visibleDocuments.length}
                  </span>
                ) : null}
              </div>
            ) : null}
            {documents.length ? (
              <div className="space-y-2">
                {visibleDocuments.length ? (
                  visibleDocuments.map((document) => (
                    <DocumentRow
                      key={document.id}
                      document={document}
                      onDelete={() => setDocumentToDelete(document)}
                    />
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-main-700 px-4 py-8 text-center">
                    <SearchIcon className="mx-auto size-5 text-main-500" />
                    <p className="mt-2 text-sm text-main-300">
                      Документы не найдены
                    </p>
                    <p className="mt-1 text-xs text-main-500">
                      Измените поисковый запрос.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : tab === "settings" ? (
          <div
            data-tour="knowledge-settings"
            className="grid gap-5 p-5 xl:grid-cols-[220px_minmax(0,1fr)]"
          >
            <Lead
              title="Основное"
              description="Основная информация о базе данных"
            />
            <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-1">
              <Field
                label={
                  <ParameterLabel description="Отображаемое название базы знаний в списках, настройках агентов и узлах сценария.">
                    Название
                  </ParameterLabel>
                }
              >
                <InputSmall
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field
                label={
                  <ParameterLabel description="Кратко объясняет назначение и состав базы знаний, чтобы отличать её от других хранилищ.">
                    Описание
                  </ParameterLabel>
                }
              >
                <InputBig
                  value={description}
                  classNames={{
                    textarea: "resize-none",
                  }}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
            </div>
            <Lead
              title="Векторизация"
              description="Embedding-модель и параметры разбиения фиксируются для загруженных документов. Для их смены сначала очистите хранилище."
            />
            <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2">
              <Field
                label={
                  <ParameterLabel description="Преобразует фрагменты документов и поисковые запросы в числовые векторы. Для одного индекса должна использоваться одна модель.">
                    Embedding-модель
                  </ParameterLabel>
                }
                className="md:col-span-2"
              >
                <Select
                  value={embeddingModelId}
                  onChange={setEmbeddingModelId}
                  className="w-full"
                  disabled={documents.length > 0}
                  options={embeddingModels.map((item) => ({
                    value: String(item.id),
                    label: textProviderStore.modelLabel(item.id),
                  }))}
                  placeholder="Выберите embedding-модель"
                  searchable
                  classNames={{ search: "mb-3" }}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Menu>
                    {embeddingModels.map((item) => (
                      <Select.Option
                        key={item.id}
                        value={String(item.id)}
                        label={textProviderStore.modelLabel(item.id)}
                      />
                    ))}
                  </Select.Menu>
                </Select>
              </Field>
              <Field
                label={
                  <ParameterLabel description="Максимальный размер одного фрагмента в приблизительных токенах. Большие чанки сохраняют больше контекста, но могут снижать точность поиска.">
                    Размер чанка
                  </ParameterLabel>
                }
              >
                <InputSmall
                  type="number"
                  min={100}
                  max={4096}
                  disabled={documents.length > 0}
                  value={chunkSize}
                  onChange={(event) => setChunkSize(event.target.value)}
                />
              </Field>
              <Field
                label={
                  <ParameterLabel description="Количество токенов, повторяющихся между соседними чанками. Помогает не потерять смысл на границе фрагментов.">
                    Перекрытие
                  </ParameterLabel>
                }
              >
                <InputSmall
                  type="number"
                  min={0}
                  disabled={documents.length > 0}
                  value={chunkOverlap}
                  onChange={(event) => setChunkOverlap(event.target.value)}
                />
              </Field>
              <Field
                label={
                  <ParameterLabel description="Определяет способ отбора и ранжирования фрагментов при запросе к базе знаний.">
                    Режим поиска
                  </ParameterLabel>
                }
                className="md:col-span-2 w-fit"
              >
                <Select
                  value={searchMode}
                  onChange={(value) =>
                    setSearchMode(value as "vector" | "hybrid")
                  }
                  options={[
                    { value: "vector", label: "Векторный" },
                    { value: "hybrid", label: "Гибридный" },
                  ]}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Menu>
                    <Select.Option value="vector" label="Векторный" />
                    <Select.Option value="hybrid" label="Гибридный" />
                  </Select.Menu>
                </Select>
              </Field>
              <Alert
                variant="info"
                title={
                  searchMode === "vector"
                    ? "Векторный поиск"
                    : "Гибридный поиск"
                }
                className="md:col-span-2"
              >
                {searchMode === "vector"
                  ? "Запрос преобразуется выбранной embedding-моделью, после чего в ответ попадают ближайшие по смыслу фрагменты. Точное совпадение слов не обязательно."
                  : "Одновременно выполняется семантический и полнотекстовый поиск, затем результаты объединяются и ранжируются. Это повышает точность для названий, терминов, артикулов и точных формулировок."}
              </Alert>
            </div>
          </div>
        ) : (
          <div
            data-tour="knowledge-search"
            className="mx-auto max-w-4xl space-y-5 p-5"
          >
            <div className="flex gap-2">
              <InputSmall
                className="w-lg"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Введите запрос для проверки..."
              />
              <Button
                variant="secondary"
                loading={searching}
                className="px-2"
                disabled={!query.trim() || searching}
                onClick={() => {
                  setSearching(true);
                  void vectorStoreStore
                    .search({ vectorStoreIds: [model.id], query, limit: 5 })
                    .then(setResults)
                    .catch((error) =>
                      toasts.danger({
                        title: "Ошибка поиска",
                        description:
                          error instanceof Error
                            ? error.message
                            : String(error),
                      }),
                    )
                    .finally(() => setSearching(false));
                }}
              >
                <SearchIcon className="size-4" />
                Найти
              </Button>
            </div>
            {results.length ? (
              <div className="space-y-2">
                {results.map((item) => (
                  <article
                    key={`${item.documentId}:${item.chunkIndex}`}
                    className="rounded-xl bg-main-800/45 p-4 ring-1 ring-main-700/35"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-main-200">
                        {item.fileName}
                      </span>
                      <span className="text-accent-light">
                        {Math.round(item.score * 100)}%
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-main-400">
                      {item.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-main-700 text-center">
                <div>
                  <SearchIcon className="mx-auto size-6 text-main-500" />
                  <p className="mt-3 text-sm text-main-300">
                    Результаты поиска появятся здесь
                  </p>
                  <p className="mt-1 text-xs text-main-500">
                    Введите запрос, чтобы проверить индекс и релевантность
                    фрагментов.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      <StorageVecdbMultipleIndexForm
        open={multipleIndexOpen}
        onClose={() => setMultipleIndexOpen(false)}
        onSubmit={(directoryPath) => {
          setDirectoryIndexing(true);
          void vectorStoreStore
            .addDirectory(model.id, directoryPath)
            .then((count) =>
              toasts.success({
                title: "Индексация завершена",
                description: `Обработано документов: ${count}.`,
              }),
            )
            .catch((error) =>
              toasts.danger({
                title: "Не удалось проиндексировать папку",
                description:
                  error instanceof Error ? error.message : String(error),
              }),
            )
            .finally(() => setDirectoryIndexing(false));
        }}
      />
      <DangerModal
        open={clearModalOpen}
        model={model}
        title="Очистить хранилище?"
        description={
          <>
            Все документы и созданные для них фрагменты будут удалены. Само
            хранилище «
            <strong className="font-semibold text-main-50">{model.name}</strong>
            » и его настройки сохранятся. Это действие нельзя отменить.
          </>
        }
        confirmLabel="Очистить"
        onCancel={() => setClearModalOpen(false)}
        onConfirm={async () => {
          await vectorStoreStore.clearDocuments(model.id);
          setDocumentQuery("");
          setResults([]);
          setClearModalOpen(false);
          toasts.success({ title: "Хранилище очищено" });
        }}
      />
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
                description:
                  error instanceof Error ? error.message : String(error),
              }),
            );
        }}
      />
    </div>
  );
});

function DocumentRow({
  document,
  onDelete,
}: {
  document: VectorDocument;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-main-800/45 p-3 ring-1 ring-main-700/30">
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
              <p className="mt-1 text-xs leading-5 text-main-500">
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

function StorageSummary({
  model,
  documents,
  embeddingModelLabel,
  backgroundIndexing,
  progress,
  progressLabel,
}: {
  model: VectorStoreModel;
  documents: VectorDocument[];
  embeddingModelLabel: string;
  backgroundIndexing: boolean;
  progress: number;
  progressLabel: string;
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

      {backgroundIndexing ? (
        <ProgressBar
          className="mt-4 border-t border-main-700/35 pt-4"
          value={progress}
          max={100}
          showValue
          label={progressLabel}
        />
      ) : null}
    </section>
  );
}

function SummaryMetric({
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

function storageStatus(status: VectorStoreModel["status"]) {
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

function collectFolderPaths(documents: VectorDocument[]) {
  const folders = new Set<string>();
  for (const document of documents) {
    const parts = document.fileName.replaceAll("\\", "/").split("/");
    for (let index = 1; index < parts.length; index += 1)
      folders.add(parts.slice(0, index).join("/"));
  }
  return folders;
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.round(value / 1024)} КБ`
    : `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function documentStatusLabel(status: VectorDocument["status"]) {
  if (status === "extracting") return "Извлечение текста";
  if (status === "embedding") return "Векторизация";
  return "Ожидает обработки";
}
