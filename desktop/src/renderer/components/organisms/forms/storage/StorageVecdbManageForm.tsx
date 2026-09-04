import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Button, Tabs, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { TrashIcon } from "../../../atoms";
import { DangerModal } from "../../modals";
import { vectorStoreStore, type VectorStoreModel } from "../../../../stores";
import { ProvidedEntityManageHeader } from "@renderer/components/molecules";
import { StorageVecdbMultipleIndexForm } from "./StorageVecdbMultipleIndexForm";
import { humanizeError } from "@renderer/lib/plain-language";
import {
  useVecdbSettingsForm,
  VecdbDocumentsTab,
  VecdbProviderTab,
  VecdbSearchTab,
  VecdbSettingsTab,
} from "./vecdb";

type DetailTab = "documents" | "settings" | "provider" | "search";

interface StorageVecdbManageFormProps {
  model: VectorStoreModel;
}

export const StorageVecdbManageForm = observer(function StorageVecdbManageForm({
  model,
}: StorageVecdbManageFormProps) {
  const toasts = useToasts();
  const [tab, setTab] = useState<DetailTab>("documents");
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [multipleIndexOpen, setMultipleIndexOpen] = useState(false);
  const [directoryIndexing, setDirectoryIndexing] = useState(false);
  const form = useVecdbSettingsForm(model);
  const documents = vectorStoreStore.documentsFor(model.id);
  const backgroundIndexing =
    directoryIndexing ||
    model.status === "indexing" ||
    vectorStoreStore.processingDocuments(model.id).length > 0;

  useEffect(() => {
    if (tab !== "documents") return;
    vectorStoreStore.startMonitoring(model.id);
    return () => vectorStoreStore.stopMonitoring();
  }, [tab, model.id]);

  return (
    <div data-tour="knowledge-form" className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-5 pt-5">
        <ProvidedEntityManageHeader
          model={{
            ...model,
            name: form.name.trim() || model.name,
            kind: "vecstore",
          }}
          description={form.description || "Описание не задано"}
          onSave={form.save}
          canSave={form.valid && form.dirty}
          saving={form.saving}
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
              {
                value: "settings",
                label: "Настройки",
              },
              {
                value: "provider",
                label: "Провайдер",
              },
              { value: "search", label: "Тест поиска" },
            ]}
          />
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "documents" ? (
          <VecdbDocumentsTab
            model={model}
            backgroundIndexing={backgroundIndexing}
            directoryIndexing={directoryIndexing}
            onOpenMultipleIndex={() => setMultipleIndexOpen(true)}
          />
        ) : tab === "settings" ? (
          <VecdbSettingsTab form={form} documentCount={documents.length} />
        ) : tab === "provider" ? (
          <VecdbProviderTab />
        ) : (
          <VecdbSearchTab model={model} documentCount={documents.length} />
        )}
      </div>
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
                description: humanizeError(error),
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
          setClearModalOpen(false);
          toasts.success({ title: "Хранилище очищено" });
        }}
      />
    </div>
  );
});
