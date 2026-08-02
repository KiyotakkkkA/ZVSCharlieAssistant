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
import type {
  TextProviderKind,
  TextProviderModelInfo,
  TextProviderType,
} from "../../../../ipc/contracts";
import {
  RefreshIcon,
  RobotIcon,
  SaveIcon,
  SecretOrientedSelect,
} from "../../atoms";
import { SettingsProviderModelCard } from "../../molecules";
import { textProviderStore } from "../../../stores";

const API_KEYS_CATEGORY_ID = 1;
export type ProviderStatus = "connected" | "unchecked" | "error";
export interface ProviderModelDraft extends TextProviderModelInfo {
  enabled: boolean;
}
export interface SettingsProviderDraft {
  id: number | null;
  name: string;
  kind: TextProviderKind;
  providerType: TextProviderType;
  baseUrl: string;
  apiKeySecretId: string;
  enabled: boolean;
  status: ProviderStatus;
  models: ProviderModelDraft[];
  checkedAt?: string;
}

interface SettingsProviderManageFormProps {
  model: SettingsProviderDraft;
  checking: boolean;
  canSave: boolean;
  onChange: (patch: Partial<SettingsProviderDraft>) => void;
  onConnectionChange: (patch: Partial<SettingsProviderDraft>) => void;
  onModelChange: (modelId: string, enabled: boolean) => void;
  onTestConnection: () => void | Promise<void>;
}

export function SettingsProviderManageForm({
  model,
  checking,
  canSave,
  onChange,
  onConnectionChange,
  onModelChange,
  onTestConnection,
}: SettingsProviderManageFormProps) {
  const toasts = useToasts();
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await textProviderStore.upsert({
        id: model.id ?? undefined,
        kind: model.kind,
        providerType: model.providerType,
        name: model.name,
        baseUrl: model.baseUrl,
        apiKeySecretId: model.apiKeySecretId
          ? Number(model.apiKeySecretId)
          : undefined,
        enabled: model.enabled,
        enabledModelIds: model.models
          .filter((item) => item.enabled)
          .map((item) => item.id),
      });
      toasts.success({
        title: "Настройки сохранены",
        description:
          model.providerType === "text"
            ? "Провайдер доступен чату и агентам."
            : "Провайдер доступен сервисам эмбеддингов.",
      });
    } catch (error) {
      toasts.danger({
        title: "Не удалось сохранить",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
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
                  {model.name}
                </h2>
                <Badge
                  rounded="rounded-full"
                  className="bg-main-700/60 text-main-300"
                >
                  Ollama
                </Badge>
              </div>
              <p className="mt-1 text-xs text-main-500">
                {model.checkedAt
                  ? `Проверен ${new Date(model.checkedAt).toLocaleTimeString("ru-RU")}`
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
              disabled={!model.baseUrl.trim() || checking}
              onClick={() => void onTestConnection()}
            >
              Проверить подключение
            </Button>
            <Button
              variant="primary"
              rounded="rounded-full"
              loading={saving}
              loadingText="Сохранение…"
              className="px-4"
              classNames={{ loaderIcon: "hidden" }}
              disabled={!canSave || saving}
              title={canSave ? undefined : "Сначала проверьте подключение"}
              onClick={() => void save()}
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
                value={model.name}
                onChange={(event) => onChange({ name: event.target.value })}
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
                value={model.baseUrl}
                onChange={(event) =>
                  onConnectionChange({ baseUrl: event.target.value })
                }
                placeholder="http://127.0.0.1:11434"
              />
            </Field>
            <Field label="Ключ API (необязательно)" className="md:col-span-2">
              <SecretOrientedSelect
                categoryId={API_KEYS_CATEGORY_ID}
                value={model.apiKeySecretId}
                onChange={(apiKeySecretId) =>
                  onConnectionChange({ apiKeySecretId })
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
                  {model.providerType === "text"
                    ? "После сохранения будет доступен чату и агентам."
                    : "После сохранения будет доступен сервисам эмбеддингов."}
                </p>
              </div>
              <InputCheckSlided
                checked={model.enabled}
                onChange={(enabled) => onChange({ enabled })}
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
                Доступно: {model.models.length}
              </span>
              <Button
                variant="ghost"
                rounded="rounded-lg"
                className="px-3 text-main-300"
                loading={checking}
                disabled={model.status !== "connected" || checking}
                onClick={() => void onTestConnection()}
              >
                <RefreshIcon className="size-4" />
                Синхронизировать
              </Button>
            </div>
            {model.models.length ? (
              <div className="space-y-2">
                {model.models.map((item) => (
                  <SettingsProviderModelCard
                    key={item.id}
                    model={item}
                    enabled={item.enabled}
                    onEnabledChange={(enabled) =>
                      onModelChange(item.id, enabled)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-main-700 px-6 text-center text-sm text-main-500">
                {model.status === "error"
                  ? "Исправьте параметры и повторите проверку подключения."
                  : "Проверьте подключение"}
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
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
