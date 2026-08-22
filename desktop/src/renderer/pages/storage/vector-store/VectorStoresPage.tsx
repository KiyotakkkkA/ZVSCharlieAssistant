import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { EmptyState, ScrollArea, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { StorageIcon } from "../../../components/atoms";
import { PrimaryButton } from "../../../components/atoms/buttons";
import { PageHeader } from "../../../components/organisms";
import { vectorStoreStore, type VectorStoreModel } from "../../../stores";
import { StorageVecdbManageForm } from "@renderer/components/organisms/forms";
import { DangerModal } from "@renderer/components/organisms/modals";
import { ProvidedEntitySidebarCard } from "@renderer/components/molecules";

export const VectorStoresPage = observer(function VectorStoresPage() {
  const store = vectorStoreStore;
  const toasts = useToasts();
  const [storeToDelete, setStoreToDelete] = useState<VectorStoreModel | null>(
    null,
  );
  const selected = store.selectedStore;
  const documentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const document of store.documents)
      counts.set(
        document.vectorStoreId,
        (counts.get(document.vectorStoreId) ?? 0) + 1,
      );
    return counts;
  }, [store.documents]);
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Векторные базы"
        description="Загружайте документы и управляйте базами знаний для агентов и сценариев."
        breadcrumbs={[{ label: "Хранилище" }, { label: "Векторные базы" }]}
      >
        <PrimaryButton
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
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-main-800/40">
          <div className="border-b border-main-700/35 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-main-500">
            Хранилища · {store.stores.length}
          </div>
          <ScrollArea className="min-h-0 flex-1 p-2">
            <div className="space-y-1.5">
              {store.stores.map((item) => (
                <ProvidedEntitySidebarCard
                  model={{ ...item, kind: "vecstore" }}
                  description={`
                      ${documentCounts.get(item.id) ?? 0} документов
                    `}
                  active={item.id === store.selectedStoreId}
                  onClick={() => {
                    store.selectedStoreId = item.id;
                  }}
                  onDelete={() => setStoreToDelete(item)}
                />
              ))}
            </div>
          </ScrollArea>
        </aside>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-main-800/40">
          {selected ? (
            <StorageVecdbManageForm key={selected.id} model={selected} />
          ) : (
            <div className="grid h-full place-items-center">
              <EmptyState
                icon={<StorageIcon className="size-6" />}
                title="Хранилищ пока нет"
                description="Создайте базу знаний и выберите embedding-модель."
                action={
                  <PrimaryButton
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
      <DangerModal
        open={!!storeToDelete}
        model={storeToDelete}
        title="Удалить векторное хранилище?"
        description={(item) => (
          <>
            Хранилище «
            <strong className="font-semibold text-main-50">{item.name}</strong>
            », документы и поисковый индекс будут удалены.
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
