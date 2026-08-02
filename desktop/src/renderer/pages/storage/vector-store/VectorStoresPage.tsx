import { useState } from "react";
import { observer } from "mobx-react-lite";
import { EmptyState, ScrollArea, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { StorageIcon } from "../../../components/atoms";
import { CreateButton } from "../../../components/atoms/buttons";
import {
  DangerModal,
  PageHeader,
  StorageVecdbManageForm,
} from "../../../components/organisms";
import { vectorStoreStore, type VectorStoreModel } from "../../../stores";

export const VectorStoresPage = observer(function VectorStoresPage() {
  const store = vectorStoreStore;
  const toasts = useToasts();
  const [storeToDelete, setStoreToDelete] = useState<VectorStoreModel | null>(
    null,
  );
  const selected = store.selectedStore;
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Векторные базы"
        description="Загружайте документы и управляйте базами знаний для агентов и сценариев."
        breadcrumbs={[{ label: "Хранилище" }, { label: "Векторные базы" }]}
      >
        <CreateButton
          label="Добавить хранилище"
          onClick={() => {
            void store.createStore().catch((error) =>
              toasts.danger({
                title: "Не удалось создать хранилище",
                description:
                  error instanceof Error ? error.message : String(error),
              }),
            );
          }}
        />
      </PageHeader>
      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-main-800/30">
          <div className="border-b border-main-700/35 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-main-500">
            Хранилища · {store.stores.length}
          </div>
          <ScrollArea className="min-h-0 flex-1 p-2">
            <div className="space-y-1.5">
              {store.stores.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    store.selectedStoreId = item.id;
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${item.id === store.selectedStoreId ? "bg-main-700/65" : "hover:bg-main-700/35"}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
                    <StorageIcon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-main-100">
                      {item.name}
                    </span>
                    <span className="mt-1 block text-xs text-main-500">
                      {store.documentsFor(item.id).length} документов
                    </span>
                    <Status status={item.status} />
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-main-800/35">
          {selected ? (
            <StorageVecdbManageForm
              key={selected.id}
              model={selected}
              onDelete={() => setStoreToDelete(selected)}
            />
          ) : (
            <div className="grid h-full place-items-center">
              <EmptyState
                icon={<StorageIcon className="size-6" />}
                title="Хранилищ пока нет"
                description="Создайте базу знаний и выберите embedding-модель."
                action={
                  <CreateButton
                    label="Добавить хранилище"
                    onClick={() => {
                      void store.createStore().catch((error) =>
                        toasts.danger({
                          title: "Не удалось создать хранилище",
                          description:
                            error instanceof Error
                              ? error.message
                              : String(error),
                        }),
                      );
                    }}
                  />
                }
              />
            </div>
          )}
        </div>
      </div>
      {storeToDelete ? (
        <DangerModal
          model={storeToDelete}
          title="Удалить векторное хранилище?"
          description={(item) => (
            <>
              Хранилище «{item.name}», документы и поисковый индекс будут
              удалены.
            </>
          )}
          onCancel={() => setStoreToDelete(null)}
          onConfirm={(item) => {
            setStoreToDelete(null);
            void store
              .deleteStore(item.id)
              .then(() => toasts.success({ title: "Хранилище удалено" }))
              .catch((error) =>
                toasts.danger({
                  title: "Не удалось удалить хранилище",
                  description:
                    error instanceof Error ? error.message : String(error),
                }),
              );
          }}
        />
      ) : null}
    </section>
  );
});

function Status({ status }: { status: VectorStoreModel["status"] }) {
  const labels = {
    ready: "Готово",
    indexing: "Индексация",
    degraded: "Есть ошибки",
    disabled: "Не настроено",
  };
  return (
    <span
      className={`mt-2 inline-flex text-[10px] ${status === "ready" ? "text-success-light" : "text-main-500"}`}
    >
      {labels[status]}
    </span>
  );
}
