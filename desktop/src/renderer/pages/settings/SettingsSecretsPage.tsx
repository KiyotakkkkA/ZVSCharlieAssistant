import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  EmptyState,
  Table,
  Tabs,
  useToasts,
  type TableColumn,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { SecretCategory, SecretEntity } from "../../../ipc/contracts";
import {
  CopyIcon,
  EditIcon,
  FolderIcon,
  KeyIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
} from "../../components/atoms";
import {
  SettingsSecretCategoryManageForm,
  SettingsSecretManageForm,
} from "../../components/organisms/forms";
import { DangerModal, FormModal, PageHeader } from "../../components/organisms";
import { secretStorageStore } from "../../stores";
import {
  ControlButton,
  CreateButton,
} from "@renderer/components/atoms/buttons";

type ActiveSection = "secrets" | "categories";
type ManageDialog =
  | { kind: "secret"; model?: SecretEntity; action?: "upsert" | "delete" }
  | { kind: "category"; model?: SecretCategory; action?: "upsert" | "delete" }
  | null;

interface SecretTableRow extends SecretEntity {
  [key: string]: unknown;
}

interface CategoryTableRow extends SecretCategory {
  [key: string]: unknown;
}

const badgeClassName =
  "inline-flex rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300";

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

export const SettingsSecretsPage = observer(function SettingsSecretsPage() {
  const store = secretStorageStore;
  const toasts = useToasts();
  const [activeSection, setActiveSection] = useState<ActiveSection>("secrets");
  const [dialog, setDialog] = useState<ManageDialog>(null);

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
      await navigator.clipboard.writeText(secret.content);
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

  const secretColumns: Array<TableColumn<SecretTableRow>> = [
    {
      key: "label",
      title: "Название",
      render: (secret) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-main-800 text-main-300">
            <KeyIcon className="size-4" />
          </span>
          <span className="font-medium text-main-100">{secret.label}</span>
        </div>
      ),
    },
    {
      key: "category",
      title: "Категория",
      render: (secret) => (
        <span className="text-main-300">
          {store.categoryLabel(secret.categoryId)}
        </span>
      ),
    },
    {
      key: "content",
      title: "Значение",
      render: () => (
        <span className="font-mono text-sm tracking-widest text-main-500">
          ••••••••••••
        </span>
      ),
    },
    {
      key: "type",
      title: "Тип",
      render: (secret) => (
        <span className={badgeClassName}>
          {secret.builtin ? "Системный" : "Пользовательский"}
        </span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (secret) => (
        <div className="flex justify-end gap-1">
          <ControlButton
            icon="copy"
            title="Скопировать"
            onClick={() => void copySecret(secret)}
          />
          <ControlButton
            icon="edit"
            title="Изменить"
            onClick={() =>
              setDialog({ kind: "secret", model: secret, action: "upsert" })
            }
          />
          <ControlButton
            icon="trash"
            variant="delete"
            title="Удалить"
            onClick={() =>
              setDialog({ kind: "secret", model: secret, action: "delete" })
            }
          />
        </div>
      ),
    },
  ];

  const categoryColumns: Array<TableColumn<CategoryTableRow>> = [
    {
      key: "label",
      title: "Название",
      render: (category) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-main-800 text-main-300">
            <FolderIcon className="size-4" />
          </span>
          <span className="font-medium text-main-100">{category.label}</span>
        </div>
      ),
    },
    {
      key: "count",
      title: "Секретов",
      render: (category) => (
        <span className="text-main-300">
          {
            store.secrets.filter((secret) => secret.categoryId === category.id)
              .length
          }
        </span>
      ),
    },
    {
      key: "type",
      title: "Тип",
      render: (category) => (
        <span className={badgeClassName}>
          {category.builtin ? "Системная" : "Пользовательская"}
        </span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (category) => (
        <div className="flex justify-end">
          {category.builtin ? null : (
            <>
              <ControlButton
                icon="edit"
                title="Изменить"
                onClick={() =>
                  setDialog({
                    kind: "category",
                    model: category,
                    action: "upsert",
                  })
                }
              />
              <ControlButton
                icon="trash"
                variant="delete"
                title="Удалить"
                onClick={() =>
                  setDialog({
                    kind: "category",
                    model: category,
                    action: "delete",
                  })
                }
              />
            </>
          )}
        </div>
      ),
    },
  ];

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
          <CreateButton
            label={isSecrets ? "Добавить секрет" : "Добавить категорию"}
            onClick={openCreateDialog}
          />
        }
      />
    );
  };

  const dataIsEmpty =
    activeSection === "secrets"
      ? store.secrets.length === 0
      : store.categories.length === 0;

  return (
    <section className="flex min-h-full flex-col p-4">
      <PageHeader
        title="Менеджер секретов"
        description="Управляйте ключами, токенами и учётными данными, которые используют ваши агенты."
        breadcrumbs={[{ label: "Настройки" }, { label: "Секреты" }]}
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
        <CreateButton
          label={
            activeSection === "secrets"
              ? "Добавить секрет"
              : "Добавить категорию"
          }
          onClick={openCreateDialog}
        />
      </PageHeader>

      <div className="min-h-64 flex-1 p-1">
        {dataIsEmpty || store.error ? (
          <div className="grid min-h-80 place-items-center">
            {renderEmptyState()}
          </div>
        ) : activeSection === "secrets" ? (
          <Table<SecretTableRow>
            data={store.secrets.map((secret) => ({ ...secret }))}
            columns={secretColumns}
            rowKey="id"
            classNames={{
              root: "w-full",
              row: "transition-colors hover:bg-main-800/45",
            }}
          />
        ) : (
          <Table<CategoryTableRow>
            data={store.categories.map((category) => ({ ...category }))}
            columns={categoryColumns}
            rowKey="id"
            classNames={{
              root: "w-full",
              row: "transition-colors hover:bg-main-800/45",
            }}
          />
        )}
      </div>

      {dialog?.kind === "secret" && dialog.action === "upsert" ? (
        <FormModal
          form={{
            component: SettingsSecretManageForm,
            title: modalNameResolver(dialog),
            props: {
              categories: store.categories,
              onSubmit: store.upsertSecret,
            },
          }}
          model={dialog.model}
          onCancel={() => setDialog(null)}
          onConfirm={() => setDialog(null)}
        />
      ) : dialog?.kind === "category" && dialog.action === "upsert" ? (
        <FormModal
          form={{
            component: SettingsSecretCategoryManageForm,
            title: modalNameResolver(dialog),
            props: { onSubmit: store.upsertCategory },
          }}
          model={dialog.model}
          onCancel={() => setDialog(null)}
          onConfirm={() => setDialog(null)}
        />
      ) : dialog?.action === "delete" && dialog.model ? (
        <DangerModal
          model={dialog}
          title={modalNameResolver(dialog)}
          description={(target) => (
            <p>
              Вы уверены, что хотите удалить{" "}
              <span className="font-medium text-main-50">
                {target.model?.label}
              </span>
              ? Это действие нельзя будет отменить.
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
      ) : null}
    </section>
  );
});
