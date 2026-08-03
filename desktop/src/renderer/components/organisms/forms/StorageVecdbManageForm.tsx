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
  Lead,
  ParameterLabel,
  SearchIcon,
  StorageIcon,
} from "../../atoms";
import { ControlButton } from "../../atoms/buttons";
import { DangerModal } from "../modals";
import {
  textProviderStore,
  vectorStoreStore,
  type VectorDocument,
  type VectorStoreModel,
} from "../../../stores";
import type { VectorSearchResultItem } from "../../../../ipc/contracts";

type DetailTab = "documents" | "settings" | "search";
interface StorageVecdbManageFormProps {
  model: VectorStoreModel;
  onDelete: () => void;
}

export const StorageVecdbManageForm = observer(function StorageVecdbManageForm({
  model,
  onDelete,
}: StorageVecdbManageFormProps) {
  const toasts = useToasts();
  const [tab, setTab] = useState<DetailTab>("documents");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<VectorSearchResultItem[]>([]);
  const [name, setName] = useState(model.name);
  const [description, setDescription] = useState(model.description);
  const [chunkSize, setChunkSize] = useState(String(model.chunkSizeTokens));
  const [chunkOverlap, setChunkOverlap] = useState(
    String(model.chunkOverlapTokens),
  );
  const [documentToDelete, setDocumentToDelete] =
    useState<VectorDocument | null>(null);
  const documents = vectorStoreStore.documentsFor(model.id);
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
  const persist = (patch: Partial<VectorStoreModel>) => {
    void vectorStoreStore.updateStore(model.id, patch).catch((error) =>
      toasts.danger({
        title: "Не удалось сохранить настройки",
        description: error instanceof Error ? error.message : String(error),
      }),
    );
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-main-700/35 px-5 pt-5">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
              <StorageIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-main-50">
                {model.name}
              </h2>
              <p className="mt-1 truncate text-xs text-main-500">
                {model.description || "Описание не задано"}
              </p>
            </div>
          </div>
          <ControlButton
            icon="trash"
            variant="delete"
            title="Удалить хранилище"
            onClick={onDelete}
          />
        </div>
        <Tabs
          value={tab}
          onChange={(value) => setTab(value as DetailTab)}
          options={[
            { value: "documents", label: `Документы · ${documents.length}` },
            { value: "settings", label: "Настройки" },
            { value: "search", label: "Тест поиска" },
          ]}
        />
      </header>
      <ScrollArea className="min-h-0 flex-1">
        {tab === "documents" ? (
          <div className="space-y-4 p-5">
            <InputDropZone
              files={[]}
              multiple
              accept=".pdf,.docx,.txt"
              emptyIcon="mdi:file-upload-outline"
              selectedIcon="mdi:file-check-outline"
              fileIcon="mdi:file-document-outline"
              emptyTitle="Перетащите документы или выберите файлы"
              emptyDescription="PDF, DOCX и TXT · документы будут обработаны в фоне"
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
              <div className="space-y-2">
                {documents.map((document) => (
                  <DocumentRow
                    key={document.id}
                    document={document}
                    onDelete={() => setDocumentToDelete(document)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : tab === "settings" ? (
          <div className="grid gap-5 p-5 xl:grid-cols-[220px_minmax(0,1fr)]">
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
                  onBlur={() => {
                    const value = name.trim();
                    if (!value) {
                      setName(model.name);
                      return;
                    }
                    if (value !== model.name) persist({ name: value });
                  }}
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
                  onBlur={() => {
                    if (description !== model.description)
                      persist({ description });
                  }}
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
                  value={
                    model.embeddingModelId ? String(model.embeddingModelId) : ""
                  }
                  onChange={(value) =>
                    persist({
                      embeddingModelId: Number(value),
                    })
                  }
                  className="w-full"
                  disabled={documents.length > 0}
                  options={embeddingModels.map((item) => ({
                    value: String(item.id),
                    label: textProviderStore.modelLabel(item.id),
                  }))}
                  placeholder="Выберите embedding-модель"
                  searchable
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
                  onBlur={() => {
                    const value = Number(chunkSize);
                    if (
                      !Number.isInteger(value) ||
                      value < 100 ||
                      value > 4096
                    ) {
                      setChunkSize(String(model.chunkSizeTokens));
                      return;
                    }
                    if (value !== model.chunkSizeTokens)
                      persist({ chunkSizeTokens: value });
                  }}
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
                  onBlur={() => {
                    const value = Number(chunkOverlap);
                    if (
                      !Number.isInteger(value) ||
                      value < 0 ||
                      value > Number(chunkSize) / 2
                    ) {
                      setChunkOverlap(String(model.chunkOverlapTokens));
                      return;
                    }
                    if (value !== model.chunkOverlapTokens)
                      persist({ chunkOverlapTokens: value });
                  }}
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
                  value={model.searchMode}
                  onChange={(value) =>
                    persist({
                      searchMode: value as "vector" | "hybrid",
                    })
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
                variant={model.searchMode === "vector" ? "info" : "warning"}
                title={
                  model.searchMode === "vector"
                    ? "Векторный поиск"
                    : "Гибридный поиск"
                }
                className="md:col-span-2"
              >
                {model.searchMode === "vector"
                  ? "Запрос преобразуется выбранной embedding-моделью, после чего LanceDB возвращает ближайшие по смыслу фрагменты. Точное совпадение слов не обязательно."
                  : "Сейчас используется векторное ранжирование. Полнотекстовый индекс и объединение семантической оценки с совпадениями ключевых слов пока не активированы."}
              </Alert>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-5 p-5">
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
      <DangerModal
          open={documentToDelete !== null}
          model={documentToDelete}
          title="Удалить документ?"
          description={(item) => (
            <>Документ «{item.fileName}» и все его чанки будут удалены.</>
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
