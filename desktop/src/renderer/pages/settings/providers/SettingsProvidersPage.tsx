import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { toJS } from "mobx";
import {
  EmptyState,
  ScrollArea,
  Tabs,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import {
  OllamaIcon,
  OpenrouterIcon,
  RobotIcon,
} from "../../../components/atoms";
import {
  ControlButton,
  PrimaryButton,
} from "../../../components/atoms/buttons";

import type { TextProviderType } from "../../../../shared/dto";
import { textProviderStore } from "../../../stores";
import { PageHeader } from "@renderer/components/organisms";
import {
  ProviderStatus,
  SettingsProviderDraft,
  SettingsProviderManageForm,
} from "@renderer/components/organisms/forms";
import { DangerModal } from "@renderer/components/organisms/modals";

const ICONS = {
  ollama: OllamaIcon,
  openrouter: OpenrouterIcon,
} as const;

const PROVIDER_LABELS = {
  ollama: "Ollama",
  openrouter: "OpenRouter",
} as const;

const statusMeta: Record<ProviderStatus, { label: string; className: string }> =
  {
    connected: { label: "Проверен", className: "text-success-light" },
    unchecked: { label: "Не проверен", className: "text-main-500" },
    error: { label: "Ошибка", className: "text-danger-light" },
  };

const IconResolver = (icon: keyof typeof ICONS) => {
  const IconComponent = ICONS[icon];
  return <IconComponent className="size-5" />;
};

export const SettingsProvidersPage = observer(function SettingsProvidersPage() {
  const toasts = useToasts();
  const [providers, setProviders] = useState<SettingsProviderDraft[]>([]);
  const [activeType, setActiveType] = useState<TextProviderType>("text");
  const [selectedId, setSelectedId] = useState<number | "draft" | null>(null);
  const [checking, setChecking] = useState(false);
  const [providerToDelete, setProviderToDelete] =
    useState<SettingsProviderDraft | null>(null);
  const visible = providers.filter((item) => item.providerType === activeType);
  const selected = visible.find(
    (item) => item.id === (selectedId === "draft" ? null : selectedId),
  );
  const canSave =
    selected?.status === "connected" &&
    !checking &&
    Boolean(selected.name.trim()) &&
    Boolean(selected.baseUrl.trim()) &&
    (selected.kind !== "openrouter" || Boolean(selected.apiKeySecretId));

  useEffect(() => {
    if (!textProviderStore.initialized) return;
    const persisted = textProviderStore.providers.map(
      (provider): SettingsProviderDraft => {
        const plainProvider = toJS(provider);
        return {
          ...plainProvider,
          apiKeySecretId: plainProvider.apiKeySecretId?.toString() ?? "",
          status: "connected",
          models: textProviderStore.models
            .filter((model) => model.providerId === plainProvider.id)
            .map((model) => {
              const plainModel = toJS(model);
              return { ...plainModel, id: plainModel.remoteId };
            }),
          limits: plainProvider.limits,
        };
      },
    );
    setProviders((current) =>
      current.some((item) => item.id === null)
        ? [...persisted, ...current.filter((item) => item.id === null)]
        : persisted,
    );
    const available = persisted.filter(
      (item) => item.providerType === activeType,
    );
    setSelectedId((current) =>
      available.some((item) => item.id === current) || current === "draft"
        ? current
        : (available[0]?.id ?? null),
    );
  }, [
    textProviderStore.initialized,
    textProviderStore.providers,
    textProviderStore.models,
    activeType,
  ]);

  const updateSelected = (patch: Partial<SettingsProviderDraft>) =>
    setProviders((items) =>
      items.map((item) =>
        item.id === (selectedId === "draft" ? null : selectedId)
          ? { ...item, ...patch }
          : item,
      ),
    );
  const invalidate = (patch: Partial<SettingsProviderDraft>) =>
    updateSelected({
      ...patch,
      status: "unchecked",
      models: [],
      checkedAt: undefined,
      limits: null,
    });
  const updateModel = (id: string, enabled: boolean) =>
    selected &&
    updateSelected({
      models: selected.models.map((item) =>
        item.id === id ? { ...item, enabled } : item,
      ),
    });
  const createProvider = () => {
    setProviders((items) => [
      ...items.filter((item) => item.id !== null),
      {
        id: null,
        name: "Новое подключение Ollama",
        kind: "ollama",
        providerType: activeType,
        baseUrl: "http://127.0.0.1:11434",
        apiKeySecretId: "",
        enabled: true,
        status: "unchecked",
        models: [],
        limits: null,
        generationSettings: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.9,
        },
      },
    ]);
    setSelectedId("draft");
  };
  const testConnection = async () => {
    if (!selected || checking) return;
    setChecking(true);
    try {
      const result = await window.desktop.textProviders.testConnection({
        kind: selected.kind,
        providerType: selected.providerType,
        baseUrl: selected.baseUrl,
        apiKeySecretId: selected.apiKeySecretId
          ? Number(selected.apiKeySecretId)
          : undefined,
      });
      updateSelected({
        status: "connected",
        checkedAt: result.checkedAt,
        limits: result.limits,
        models: result.models.map((model) => ({
          ...model,
          enabled:
            selected.models.find((item) => item.id === model.id)?.enabled ??
            false,
        })),
      });
      toasts.success({
        title: "Подключение проверено",
        description: `Получено моделей: ${result.models.length}.`,
      });
    } catch (error) {
      updateSelected({
        status: "error",
        models: [],
        checkedAt: undefined,
        limits: null,
      });
      toasts.danger({
        title: `Не удалось подключиться к ${PROVIDER_LABELS[selected.kind]}`,
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Провайдеры моделей"
        description={
          activeType === "text"
            ? "Подключайте модели для чата и агентов."
            : "Подключайте модели для построения эмбеддингов."
        }
        breadcrumbs={[{ label: "Настройки" }, { label: "Провайдеры" }]}
        footer={
          <Tabs
            value={activeType}
            onChange={(next) => {
              setActiveType(next as TextProviderType);
              setSelectedId(null);
            }}
            options={[
              {
                value: "text",
                label: `Текстовые · ${providers.filter((item) => item.providerType === "text").length}`,
              },
              {
                value: "embedding",
                label: `Эмбеддинги · ${providers.filter((item) => item.providerType === "embedding").length}`,
              },
            ]}
          />
        }
      >
        <PrimaryButton label="Добавить провайдера" onClick={createProvider} />
      </PageHeader>
      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-main-800/25">
          <div className="border-b border-main-700/35 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-main-500">
            Подключения · {visible.length}
          </div>
          <ScrollArea className="min-h-0 flex-1 p-2">
            <div className="space-y-1.5">
              {visible.map((provider) => (
                <div
                  key={provider.id ?? "draft"}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(provider.id ?? "draft")}
                  className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${provider.id === (selectedId === "draft" ? null : selectedId) ? "bg-main-700/65" : "hover:bg-main-700/35"}`}
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
                    {IconResolver(provider.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-main-100">
                      {provider.name}
                    </span>
                    <span className="mt-1 block text-xs text-main-500">
                      {PROVIDER_LABELS[provider.kind]} ·{" "}
                      {provider.models.length} моделей
                    </span>
                    <span
                      className={`mt-2 block text-[10px] ${statusMeta[provider.status].className}`}
                    >
                      {statusMeta[provider.status].label}
                    </span>
                  </span>
                  {provider.id !== null ? (
                    <ControlButton
                      icon="trash"
                      variant="delete"
                      title="Удалить провайдера"
                      onClick={() => setProviderToDelete(provider)}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>
        {selected ? (
          <SettingsProviderManageForm
            model={selected}
            checking={checking}
            canSave={canSave}
            onChange={updateSelected}
            onConnectionChange={invalidate}
            onModelChange={updateModel}
            onTestConnection={testConnection}
          />
        ) : (
          <div className="grid min-h-0 flex-1 place-items-center rounded-xl bg-main-800/40">
            <EmptyState
              icon={<RobotIcon className="size-6" />}
              title="Провайдеров пока нет"
              description="Добавьте провайдера и проверьте подключение."
              action={
                <PrimaryButton
                  label="Добавить провайдера"
                  onClick={createProvider}
                />
              }
            />
          </div>
        )}
      </div>
      <DangerModal
        open={providerToDelete?.id != null}
        model={providerToDelete}
        title="Удалить провайдера?"
        description={(item) => (
          <>
            Подключение «
            <strong className="font-semibold text-main-50">{item.name}</strong>»
            и сохранённый список моделей будут удалены.
          </>
        )}
        onCancel={() => setProviderToDelete(null)}
        onConfirm={async (item) => {
          if (item.id === null) return;
          await textProviderStore.delete(item.id);
          setProviderToDelete(null);
          toasts.success({ title: "Провайдер удалён" });
        }}
      />
    </section>
  );
});
