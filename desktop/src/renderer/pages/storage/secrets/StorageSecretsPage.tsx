import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  EmptyState,
  InputSmall,
  ScrollArea,
  Switcher,
  Tabs,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { SecretCategory, SecretEntity } from "../../../../ipc/contracts";
import { FolderIcon, KeyIcon, RefreshIcon } from "../../../components/atoms";
import {
  StorageSecretCategoryManageForm,
  StorageSecretManageForm,
} from "../../../components/organisms/forms";
import { PageHeader } from "../../../components/organisms";
import {
  StorageSecretCard,
  StorageSecretCategoryCard,
} from "../../../components/molecules";
import { secretStorageStore } from "../../../stores";
import { PrimaryButton } from "@renderer/components/atoms/buttons";
import { FormModal, DangerModal } from "@renderer/components/organisms/modals";
import {
  StorageSecretCategoriesListTable,
  StorageSecretsListTable,
} from "@renderer/components/organisms/tables";

type ActiveSection = "secrets" | "categories";
type ManageDialog =
  | { kind: "secret"; model?: SecretEntity; action?: "upsert" | "delete" }
  | { kind: "category"; model?: SecretCategory; action?: "upsert" | "delete" }
  | null;

const modalNameResolver = (dialog: ManageDialog) => {
  if (!dialog) return "";
  if (dialog.kind === "secret") {
    if (dialog.action === "upsert") {
      return dialog.model ? "Изменить секрет" : "Новый секрет";
    }
    if (dialog.action === "delete") {
      return "Удалить секрет";
    }
  }
  if (dialog.kind === "category") {
    if (dialog.action === "upsert") {
      return dialog.model ? "Изменить категорию" : "Новая категория";
    }
    if (dialog.action === "delete") {
      return "Удалить категорию";
    }
  }
  return "";
};

export const StorageSecretsPage = observer(function StorageSecretsPage() {
  const store = secretStorageStore;
  const toasts = useToasts();
  const [activeSection, setActiveSection] = useState<ActiveSection>("secrets");
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [dialog, setDialog] = useState<ManageDialog>(null);
  const filteredSecrets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? store.secrets.filter((secret) =>
          secret.label.toLocaleLowerCase().includes(normalized),
        )
      : store.secrets;
  }, [query, store.secrets]);
  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? store.categories.filter((category) =>
          category.label.toLocaleLowerCase().includes(normalized),
        )
      : store.categories;
  }, [query, store.categories]);

  const openCreateDialog = () => {
    if (activeSection === "secrets" && store.categories.length === 0) {
      setActiveSection("categories");
      toasts.warning({
        title: "Сначала создайте категорию",
        description: "Каждый секрет должен принадлежать категории.",
      });
      return;
    }
    setDialog({
      kind: activeSection === "secrets" ? "secret" : "category",
      action: "upsert",
      model: undefined,
    });
  };

  const copySecret = async (secret: SecretEntity) => {
    try {
      await window.desktop.secrets.copySecret(secret.id);
      toasts.success({
        title: "Секрет скопирован",
      });
    } catch (error) {
      toasts.danger({
        title: "Не удалось скопировать секрет",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const renderEmptyState = () => {
    if (store.error) {
      return (
        <EmptyState
          icon={<RefreshIcon className="size-6" />}
          title="Не удалось загрузить хранилище"
          description={store.error}
          action={
            <Button
              variant="secondary"
              onClick={() => void store.bootstrap(true).catch(() => undefined)}
            >
              Повторить
            </Button>
          }
        />
      );
    }

    const isSecrets = activeSection === "secrets";
    if (query) {
      return (
        <EmptyState
          icon={
            isSecrets ? (
              <KeyIcon className="size-6" />
            ) : (
              <FolderIcon className="size-6" />
            )
          }
          title={isSecrets ? "Секреты не найдены" : "Категории не найдены"}
          description="Измените поисковый запрос."
        />
      );
    }
    return (
      <EmptyState
        icon={
          isSecrets ? (
            <KeyIcon className="size-6" />
          ) : (
            <FolderIcon className="size-6" />
          )
        }
        title={isSecrets ? "Секретов пока нет" : "Категорий пока нет"}
        description={
          isSecrets
            ? "Добавьте первый секрет для безопасного использования в задачах агентов."
            : "Создайте категорию, чтобы организовать секреты."
        }
        action={
          <PrimaryButton
            label={isSecrets ? "Добавить секрет" : "Добавить категорию"}
            onClick={openCreateDialog}
          />
        }
      />
    );
  };

  const dataIsEmpty =
    activeSection === "secrets"
      ? filteredSecrets.length === 0
      : filteredCategories.length === 0;

  return (
    <section data-tour="secrets-page" className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Менеджер секретов"
        description="Управляйте ключами, токенами и учётными данными, которые используют ваши агенты."
        breadcrumbs={[{ label: "Хранилище" }, { label: "Секреты" }]}
        footer={
          <div className="flex w-full items-center justify-between">
            <Tabs
              value={activeSection}
              onChange={(value) => setActiveSection(value as ActiveSection)}
              options={[
                {
                  label: `Секреты · ${store.secrets.length}`,
                  value: "secrets",
                },
                {
                  label: `Категории · ${store.categories.length}`,
                  value: "categories",
                },
              ]}
            />
            {store.loading ? (
              <span className="text-sm text-main-500">Обновление…</span>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Switcher
            value={viewMode}
            onChange={(value) => setViewMode(value as "table" | "cards")}
            options={[
              { value: "table", label: "Таблица" },
              { value: "cards", label: "Карточки" },
            ]}
          />
          <InputSmall
            preset="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder={
              activeSection === "secrets" ? "Найти секрет" : "Найти категорию"
            }
            className="w-64"
          />
          <PrimaryButton
            label={
              activeSection === "secrets"
                ? "Добавить секрет"
                : "Добавить категорию"
            }
            onClick={openCreateDialog}
          />
        </div>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1 p-1">
        {dataIsEmpty || store.error ? (
          <div className="grid min-h-80 place-items-center">
            {renderEmptyState()}
          </div>
        ) : activeSection === "secrets" && viewMode === "cards" ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {filteredSecrets.map((secret) => (
              <StorageSecretCard
                key={secret.id}
                secret={secret}
                categoryLabel={store.categoryLabel(secret.categoryId)}
                onCopy={(item) => void copySecret(item)}
                onEdit={(item) =>
                  setDialog({ kind: "secret", model: item, action: "upsert" })
                }
                onDelete={(item) =>
                  setDialog({ kind: "secret", model: item, action: "delete" })
                }
              />
            ))}
          </div>
        ) : activeSection === "categories" && viewMode === "cards" ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {filteredCategories.map((category) => (
              <StorageSecretCategoryCard
                key={category.id}
                category={category}
                secretsCount={
                  store.secrets.filter(
                    (secret) => secret.categoryId === category.id,
                  ).length
                }
                onEdit={(item) =>
                  setDialog({ kind: "category", model: item, action: "upsert" })
                }
                onDelete={(item) =>
                  setDialog({ kind: "category", model: item, action: "delete" })
                }
              />
            ))}
          </div>
        ) : activeSection === "secrets" ? (
          <StorageSecretsListTable
            secrets={filteredSecrets}
            categoryLabel={store.categoryLabel}
            onCopy={(secret) => void copySecret(secret)}
            onEdit={(secret) =>
              setDialog({ kind: "secret", model: secret, action: "upsert" })
            }
            onDelete={(secret) =>
              setDialog({ kind: "secret", model: secret, action: "delete" })
            }
          />
        ) : (
          <StorageSecretCategoriesListTable
            categories={filteredCategories}
            secretsCount={(id) =>
              store.secrets.filter((secret) => secret.categoryId === id).length
            }
            onEdit={(category) =>
              setDialog({ kind: "category", model: category, action: "upsert" })
            }
            onDelete={(category) =>
              setDialog({ kind: "category", model: category, action: "delete" })
            }
          />
        )}
      </ScrollArea>

      <FormModal
        open={dialog?.kind === "secret" && dialog.action === "upsert"}
        form={{
          component: StorageSecretManageForm,
          title: modalNameResolver(dialog),
          props: {
            categories: store.categories,
            onSubmit: store.upsertSecret,
          },
        }}
        model={dialog?.kind === "secret" ? dialog.model : undefined}
        onCancel={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
      />
      <FormModal
        open={dialog?.kind === "category" && dialog.action === "upsert"}
        form={{
          component: StorageSecretCategoryManageForm,
          title: modalNameResolver(dialog),
          props: { onSubmit: store.upsertCategory },
        }}
        model={dialog?.kind === "category" ? dialog.model : undefined}
        onCancel={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
      />
      <DangerModal
        open={dialog?.action === "delete" && dialog.model != null}
        model={dialog}
        title={modalNameResolver(dialog)}
        description={(target) => (
          <p>
            Вы уверены, что хотите удалить «
            <strong className="font-semibold text-main-50">
              {target.model?.label}
            </strong>
            »? Это действие нельзя будет отменить.
          </p>
        )}
        onCancel={() => setDialog(null)}
        onConfirm={async (target) => {
          if (target.kind === "secret") {
            await store.deleteSecret(target.model!.id);
            toasts.success({ title: "Секрет удалён" });
          } else {
            await store.deleteCategory(target.model!.id);
            toasts.success({
              title: "Категория удалена",
              description: "Все секреты в этой категории также были удалены.",
            });
          }
          setDialog(null);
        }}
      />
    </section>
  );
});
