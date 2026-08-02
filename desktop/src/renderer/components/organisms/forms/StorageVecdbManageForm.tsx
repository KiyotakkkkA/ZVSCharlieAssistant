import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputDropZone,
  InputSmall,
  ProgressBar,
  ScrollArea,
  Select,
  Tabs,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { FileIcon, SearchIcon, StorageIcon } from "../../atoms";
import { ControlButton } from "../../atoms/buttons";
import { DangerModal } from "../modals";
import {
  textProviderStore,
  vectorStoreStore,
  type VectorDocument,
  type VectorStoreModel,
} from "../../../stores";

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
                if (files.length) vectorStoreStore.addFiles(model.id, files);
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
              description="Название и назначение базы знаний."
            />
            <div className="space-y-4 rounded-xl bg-main-800/35 p-4">
              <Field label="Название">
                <InputSmall
                  value={model.name}
                  onChange={(event) =>
                    vectorStoreStore.updateStore(model.id, {
                      name: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Описание">
                <InputSmall
                  value={model.description}
                  onChange={(event) =>
                    vectorStoreStore.updateStore(model.id, {
                      description: event.target.value,
                    })
                  }
                />
              </Field>
            </div>
            <Lead
              title="Векторизация"
              description="После добавления документов смена модели потребует переиндексации."
            />
            <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2">
              <Field label="Embedding-модель" className="md:col-span-2">
                <Select
                  value={
                    model.embeddingModelId ? String(model.embeddingModelId) : ""
                  }
                  onChange={(value) =>
                    vectorStoreStore.updateStore(model.id, {
                      embeddingModelId: Number(value),
                      status: "ready",
                    })
                  }
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
              <Field label="Размер чанка">
                <InputSmall
                  type="number"
                  value={String(model.chunkSizeTokens)}
                  onChange={(event) =>
                    vectorStoreStore.updateStore(model.id, {
                      chunkSizeTokens: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Перекрытие">
                <InputSmall
                  type="number"
                  value={String(model.chunkOverlapTokens)}
                  onChange={(event) =>
                    vectorStoreStore.updateStore(model.id, {
                      chunkOverlapTokens: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Режим поиска" className="md:col-span-2">
                <Select
                  value={model.searchMode}
                  onChange={(value) =>
                    vectorStoreStore.updateStore(model.id, {
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
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-5 p-5">
            <div className="flex gap-2">
              <InputSmall
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Введите запрос для проверки релевантности..."
              />
              <Button variant="secondary" disabled={!query.trim()}>
                <SearchIcon className="size-4" />
                Найти
              </Button>
            </div>
            <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-main-700 text-center">
              <div>
                <SearchIcon className="mx-auto size-6 text-main-500" />
                <p className="mt-3 text-sm text-main-300">
                  Результаты поиска появятся здесь
                </p>
                <p className="mt-1 text-xs text-main-500">
                  Поиск будет подключён вместе с retrieval runtime.
                </p>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>
      {documentToDelete ? (
        <DangerModal
          model={documentToDelete}
          title="Удалить документ?"
          description={(item) => (
            <>Документ «{item.fileName}» и все его чанки будут удалены.</>
          )}
          onCancel={() => setDocumentToDelete(null)}
          onConfirm={(item) => {
            vectorStoreStore.deleteDocument(item.id);
            setDocumentToDelete(null);
            toasts.success({ title: "Документ удалён" });
          }}
        />
      ) : null}
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
        ) : (
          <ProgressBar
            className="mt-2"
            value={document.progress}
            max={100}
            label="Ожидает обработки"
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

function Lead({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-main-100">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-main-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-xs font-medium text-main-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatBytes(value: number) {
  return value < 1024 * 1024
    ? `${Math.round(value / 1024)} КБ`
    : `${(value / 1024 / 1024).toFixed(1)} МБ`;
}
