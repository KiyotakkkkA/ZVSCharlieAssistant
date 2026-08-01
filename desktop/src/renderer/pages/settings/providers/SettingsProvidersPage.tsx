import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Badge,
  Button,
  EmptyState,
  InputCheckSlided,
  InputSmall,
  ScrollArea,
  Select,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import {
  PlusIcon,
  RefreshIcon,
  RobotIcon,
  SaveIcon,
  SecretOrientedSelect,
  TrashIcon,
} from "../../../components/atoms";
import { SettingsProviderModelCard } from "../../../components/molecules";
import { DangerModal, PageHeader } from "../../../components/organisms";
import type {
  TextProviderKind,
  TextProviderModelInfo,
} from "../../../../ipc/contracts";
import { textProviderStore } from "../../../stores";
import {
  ControlButton,
  CreateButton,
} from "@renderer/components/atoms/buttons";

const API_KEYS_CATEGORY_ID = 1;
type ProviderStatus = "connected" | "unchecked" | "error";
interface ProviderModel extends TextProviderModelInfo {
  enabled: boolean;
}
interface ProviderDraft {
  id: number | null;
  name: string;
  kind: TextProviderKind;
  baseUrl: string;
  apiKeySecretId: string;
  enabled: boolean;
  status: ProviderStatus;
  models: ProviderModel[];
  checkedAt?: string;
}

const statusMeta: Record<ProviderStatus, { label: string; className: string }> =
  {
    connected: {
      label: "Проверен",
      className: "bg-success-medium/10 text-success-light",
    },
    unchecked: {
      label: "Не проверен",
      className: "bg-main-700/60 text-main-300",
    },
    error: {
      label: "Ошибка",
      className: "bg-danger-medium/10 text-danger-light",
    },
  };

export const SettingsProvidersPage = observer(function SettingsProvidersPage() {
  const toasts = useToasts();
  const [providers, setProviders] = useState<ProviderDraft[]>([]);
  const [selectedId, setSelectedId] = useState<number | "draft" | null>(null);
  const [checking, setChecking] = useState(false);
  const [providerToDelete, setProviderToDelete] =
    useState<ProviderDraft | null>(null);
  const selected = providers.find(
    (item) => item.id === (selectedId === "draft" ? null : selectedId),
  );
  const canSave =
    selected?.status === "connected" &&
    !checking &&
    Boolean(selected.name.trim()) &&
    Boolean(selected.baseUrl.trim());

  useEffect(() => {
    if (!textProviderStore.initialized) return;
    if (!textProviderStore.providers.length) {
      setProviders((current) =>
        current.some((item) => item.id === null) ? current : [],
      );
      setSelectedId((current) => (current === "draft" ? current : null));
      return;
    }
    const persisted = textProviderStore.providers.map(
      (provider): ProviderDraft => ({
        ...provider,
        apiKeySecretId: provider.apiKeySecretId?.toString() ?? "",
        status: "connected",
        models: textProviderStore.models.filter(
          (model) => model.providerId === provider.id,
        ),
      }),
    );
    setProviders(persisted);
    setSelectedId((current) =>
      persisted.some((item) => item.id === current)
        ? current
        : persisted[0]!.id,
    );
  }, [
    textProviderStore.initialized,
    textProviderStore.providers,
    textProviderStore.models,
  ]);

  const updateSelected = (patch: Partial<ProviderDraft>) => {
    setProviders((current) =>
      current.map((item) =>
        item.id === (selectedId === "draft" ? null : selectedId)
          ? { ...item, ...patch }
          : item,
      ),
    );
  };
  const invalidateConnection = (patch: Partial<ProviderDraft>) => {
    updateSelected({
      ...patch,
      status: "unchecked",
      models: [],
      checkedAt: undefined,
    });
  };
  const updateModel = (modelId: string, enabled: boolean) => {
    if (!selected) return;
    updateSelected({
      models: selected.models.map((model) =>
        model.id === modelId ? { ...model, enabled } : model,
      ),
    });
  };
  const createProvider = () => {
    setProviders((current) => [
      ...current.filter((item) => item.id !== null),
      {
        id: null,
        name: "Новое подключение Ollama",
        kind: "ollama",
        baseUrl: "http://127.0.0.1:11434",
        apiKeySecretId: "",
        enabled: false,
        status: "unchecked",
        models: [],
      },
    ]);
    setSelectedId("draft");
  };

  const testConnection = async () => {
    if (checking || !selected) return;
    setChecking(true);
    try {
      const result = await window.desktop.textProviders.testConnection({
        kind: selected.kind,
        baseUrl: selected.baseUrl,
        apiKeySecretId: selected.apiKeySecretId
          ? Number(selected.apiKeySecretId)
          : undefined,
      });
      setProviders((current) =>
        current.map((provider) =>
          provider.id === selected.id
            ? {
                ...provider,
                status: "connected",
                checkedAt: result.checkedAt,
                models: result.models.map((model) => ({
                  ...model,
                  enabled:
                    provider.models.find((item) => item.id === model.id)
                      ?.enabled ?? false,
                })),
              }
            : provider,
        ),
      );
      toasts.success({
        title: "Подключение проверено",
        description: `Получено моделей: ${result.models.length}.`,
      });
    } catch (error) {
      updateSelected({ status: "error", models: [], checkedAt: undefined });
      toasts.danger({
        title: "Не удалось подключиться к Ollama",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setChecking(false);
    }
  };

  if (!selected) {
    return (
      <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
        <PageHeader
          title="Провайдеры моделей"
          description="Подключайте модели для чата и агентов."
          breadcrumbs={[{ label: "Настройки" }, { label: "Провайдеры" }]}
        >
          <CreateButton label="Добавить провайдера" onClick={createProvider} />
        </PageHeader>
        <div className="grid min-h-0 flex-1 place-items-center rounded-xl bg-main-800/40">
          <EmptyState
            icon={<RobotIcon className="size-6" />}
            title="Провайдеров пока нет"
            description="Добавьте провайдера генерации текста, проверьте подключение и выберите доступные модели."
            action={
              <CreateButton
                label="Добавить провайдера"
                onClick={createProvider}
              />
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Провайдеры моделей"
        description="Подключайте модели для чата и агентов."
        breadcrumbs={[{ label: "Настройки" }, { label: "Провайдеры" }]}
      >
        <CreateButton label="Добавить провайдера" onClick={createProvider} />
      </PageHeader>

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-main-800/25">
          <div className="border-b border-main-700/35 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-main-500">
              Подключения · {providers.length}
            </p>
          </div>
          <ScrollArea className="min-h-0 flex-1 p-2">
            <div className="space-y-1.5">
              {providers.map((provider) => {
                const status = statusMeta[provider.status];
                return (
                  <div
                    key={provider.id ?? "draft"}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(provider.id ?? "draft")}
                    className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${provider.id === (selectedId === "draft" ? null : selectedId) ? "bg-main-700/65" : "hover:bg-main-700/35"}`}
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
                      <RobotIcon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-main-100">
                        {provider.name}
                      </span>
                      <span className="mt-1 block text-xs text-main-500">
                        Ollama · {provider.models.length} моделей
                      </span>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </span>
                    {provider.id !== null ? (
                      <ControlButton
                        icon="trash"
                        variant="delete"
                        title="Удалить провайдера"
                        onClick={() => {
                          setProviderToDelete(provider);
                        }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <ScrollArea className="min-h-0 min-w-0 flex-1 rounded-xl bg-main-800/40">
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-main-700/35 pb-5">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
                  <RobotIcon className="size-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-main-50">
                      {selected.name}
                    </h2>
                    <Badge
                      rounded="rounded-full"
                      className="bg-main-700/60 text-main-300"
                    >
                      Ollama
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-main-500">
                    {selected.checkedAt
                      ? `Проверен ${new Date(selected.checkedAt).toLocaleTimeString("ru-RU")}`
                      : "Подключение ещё не проверено"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  rounded="rounded-full"
                  className="px-4"
                  loading={checking}
                  loadingText="Проверка…"
                  disabled={!selected.baseUrl.trim() || checking}
                  onClick={() => void testConnection()}
                >
                  Проверить подключение
                </Button>
                <Button
                  variant="primary"
                  rounded="rounded-full"
                  className="px-4"
                  disabled={!canSave}
                  title={canSave ? undefined : "Сначала проверьте подключение"}
                  onClick={() =>
                    void textProviderStore
                      .upsert({
                        id: selected.id ?? undefined,
                        kind: selected.kind,
                        name: selected.name,
                        baseUrl: selected.baseUrl,
                        apiKeySecretId: selected.apiKeySecretId
                          ? Number(selected.apiKeySecretId)
                          : undefined,
                        enabled: selected.enabled,
                        enabledModelIds: selected.models
                          .filter((item) => item.enabled)
                          .map((item) => item.id),
                      })
                      .then(() =>
                        toasts.success({
                          title: "Настройки сохранены",
                          description: "Провайдер доступен чату и агентам.",
                        }),
                      )
                      .catch((error) =>
                        toasts.danger({
                          title: "Не удалось сохранить",
                          description:
                            error instanceof Error
                              ? error.message
                              : "Неизвестная ошибка",
                        }),
                      )
                  }
                >
                  <SaveIcon className="size-4" />
                  Сохранить
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
              <SectionLead
                title="Подключение"
                description="Endpoint, тип провайдера и опциональный ключ."
              />
              <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2">
                <Field label="Название">
                  <InputSmall
                    value={selected.name}
                    onChange={(event) =>
                      updateSelected({ name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Тип провайдера">
                  <Select
                    value="ollama"
                    onChange={() => undefined}
                    options={[{ value: "ollama", label: "Ollama" }]}
                    disabled
                  >
                    <Select.Trigger className="w-full" />
                    <Select.Menu>
                      <Select.Option value="ollama" label="Ollama" />
                    </Select.Menu>
                  </Select>
                </Field>
                <Field label="Base API URL" className="md:col-span-2">
                  <InputSmall
                    value={selected.baseUrl}
                    onChange={(event) =>
                      invalidateConnection({ baseUrl: event.target.value })
                    }
                    placeholder="http://127.0.0.1:11434"
                  />
                </Field>
                <Field
                  label="Ключ API (необязательно)"
                  className="md:col-span-2"
                >
                  <SecretOrientedSelect
                    categoryId={API_KEYS_CATEGORY_ID}
                    value={selected.apiKeySecretId}
                    onChange={(apiKeySecretId) =>
                      invalidateConnection({ apiKeySecretId })
                    }
                    placeholder="Выберите ключ или оставьте поле пустым..."
                    searchable
                    searchPlaceholder="Найти ключ"
                    className="w-full"
                    triggerClassName="w-full"
                    menuWidth="auto"
                  />
                </Field>
                <div className="md:col-span-2 flex items-center justify-between rounded-lg bg-main-700/20 p-3">
                  <div>
                    <p className="text-sm font-medium text-main-200">
                      Провайдер включён
                    </p>
                    <p className="mt-1 text-xs text-main-500">
                      После сохранения будет доступен чату и агентам.
                    </p>
                  </div>
                  <InputCheckSlided
                    checked={selected.enabled}
                    onChange={(enabled) => updateSelected({ enabled })}
                  />
                </div>
              </div>

              <SectionLead
                title="Модели"
                description="Список появляется только после успешной проверки."
              />
              <div className="rounded-xl bg-main-800/35 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-main-500">
                    Доступно: {selected.models.length}
                  </span>
                  <Button
                    variant="ghost"
                    rounded="rounded-lg"
                    className="px-3 text-main-300"
                    loading={checking}
                    disabled={selected.status !== "connected" || checking}
                    onClick={() => void testConnection()}
                  >
                    <RefreshIcon className="size-4" />
                    Синхронизировать
                  </Button>
                </div>
                {selected.models.length ? (
                  <div className="space-y-2">
                    {selected.models.map((model) => (
                      <SettingsProviderModelCard
                        key={model.id}
                        model={model}
                        enabled={model.enabled}
                        onEnabledChange={(enabled) =>
                          updateModel(model.id, enabled)
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-main-700 px-6 text-center text-sm text-main-500">
                    {selected.status === "error"
                      ? "Исправьте параметры и повторите проверку подключения."
                      : "Проверьте подключение"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
      {providerToDelete?.id !== null && providerToDelete ? (
        <DangerModal
          model={providerToDelete}
          title="Удалить провайдера?"
          description={(provider) => (
            <>
              Подключение «{provider.name}» и сохранённый список его моделей
              будут удалены.
            </>
          )}
          onCancel={() => setProviderToDelete(null)}
          onConfirm={async (provider) => {
            if (provider.id === null) return;
            await textProviderStore.delete(provider.id);
            setProviderToDelete(null);
            toasts.success({ title: "Провайдер удалён" });
          }}
        />
      ) : null}
    </section>
  );
});

function SectionLead({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
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
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-medium text-main-400">
        {label}
      </span>
      {children}
    </label>
  );
}
