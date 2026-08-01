import { useState } from "react";
import {
  Badge,
  Button,
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
} from "../../../components/atoms";
import { SettingsProviderModelCard } from "../../../components/molecules";
import { PageHeader } from "../../../components/organisms";
import type {
  TextProviderKind,
  TextProviderModelInfo,
} from "../../../../ipc/contracts";

const API_KEYS_CATEGORY_ID = 1;
type ProviderStatus = "connected" | "unchecked" | "error";
interface ProviderModel extends TextProviderModelInfo {
  enabled: boolean;
}
interface ProviderDraft {
  id: string;
  name: string;
  kind: TextProviderKind;
  baseUrl: string;
  apiKeySecretId: string;
  enabled: boolean;
  status: ProviderStatus;
  models: ProviderModel[];
  checkedAt?: string;
}

const initialProviders: ProviderDraft[] = [
  {
    id: "ollama-local",
    name: "Локальный Ollama",
    kind: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    apiKeySecretId: "",
    enabled: true,
    status: "unchecked",
    models: [],
  },
];

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

export function SettingsProvidersPage() {
  const toasts = useToasts();
  const [providers, setProviders] = useState(initialProviders);
  const [selectedId, setSelectedId] = useState(initialProviders[0]!.id);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const selected = providers.find((item) => item.id === selectedId)!;
  const checking = checkingId === selectedId;
  const canSave =
    selected.status === "connected" &&
    !checking &&
    Boolean(selected.name.trim()) &&
    Boolean(selected.baseUrl.trim());

  const updateSelected = (patch: Partial<ProviderDraft>) => {
    setProviders((current) =>
      current.map((item) =>
        item.id === selectedId ? { ...item, ...patch } : item,
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
    updateSelected({
      models: selected.models.map((model) =>
        model.id === modelId ? { ...model, enabled } : model,
      ),
    });
  };
  const createProvider = () => {
    const id = `ollama-${Date.now()}`;
    setProviders((current) => [
      ...current,
      {
        id,
        name: "Новое подключение Ollama",
        kind: "ollama",
        baseUrl: "http://127.0.0.1:11434",
        apiKeySecretId: "",
        enabled: false,
        status: "unchecked",
        models: [],
      },
    ]);
    setSelectedId(id);
  };

  const testConnection = async () => {
    if (checking) return;
    setCheckingId(selected.id);
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
                      ?.enabled ?? true,
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
      setCheckingId(null);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Провайдеры моделей"
        description="Подключайте модели для чата и агентов."
        breadcrumbs={[{ label: "Настройки" }, { label: "Провайдеры" }]}
      >
        <Button
          variant="primary"
          rounded="rounded-full"
          className="px-4"
          onClick={createProvider}
        >
          <PlusIcon className="size-4" />
          Добавить провайдера
        </Button>
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
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => setSelectedId(provider.id)}
                    className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${provider.id === selectedId ? "bg-main-700/65" : "hover:bg-main-700/35"}`}
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
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </aside>

        <ScrollArea className="min-h-0 min-w-0 flex-1 rounded-xl bg-main-800/15">
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
                    ID: {selected.id}
                    {selected.checkedAt
                      ? ` · Проверен ${new Date(selected.checkedAt).toLocaleTimeString("ru-RU")}`
                      : ""}
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
                    toasts.success({
                      title: "Настройки сохранены",
                      description: "Пока только в состоянии страницы.",
                    })
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
    </section>
  );
}

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
