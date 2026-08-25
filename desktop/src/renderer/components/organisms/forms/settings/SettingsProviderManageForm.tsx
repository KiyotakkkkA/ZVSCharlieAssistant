import { useState } from "react";
import {
  Alert,
  Button,
  InputCheckSlided,
  InputCheckBox,
  InputSmall,
  ScrollArea,
  Select,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { TextProviderLimits } from "../../../../../shared/dto";
import type { TextProviderModelInfo } from "../../../../../shared/models/text-provider";
import type {
  TextProviderGenerationSettings,
  TextProviderKind,
  TextProviderType,
} from "../../../../../shared/dto";
import {
  RefreshIcon,
  SecretOrientedSelect,
  Field,
  Lead,
  ParameterLabel,
} from "../../../atoms";
import {
  ProvidedEntityManageHeader,
  SettingsProviderMistralModelCard,
  SettingsProviderOllamaModelCard,
  SettingsProviderOpenrouterModelCard,
} from "../../../molecules";
import { textProviderStore } from "../../../../stores";
import { SYSTEM_SECRET_CATEGORY_IDS } from "../../../../../shared/entity-ids";

export type ProviderStatus = "connected" | "unchecked" | "error";
interface ProviderModelDraft extends TextProviderModelInfo {
  enabled: boolean;
}

export interface SettingsProviderDraft {
  id: string | null;
  name: string;
  kind: TextProviderKind;
  providerType: TextProviderType;
  baseUrl: string;
  apiKeySecretId: string;
  enabled: boolean;
  status: ProviderStatus;
  models: ProviderModelDraft[];
  checkedAt?: string;
  limits: TextProviderLimits | null;
  generationSettings: TextProviderGenerationSettings;
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

const BASE_URLS: Record<TextProviderKind, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "https://ollama.com",
  mistral: "https://api.mistral.ai/v1",
};

interface ModelCardProps {
  model: ProviderModelDraft;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

const PROVIDER_CARDS: Record<
  TextProviderKind,
  React.ComponentType<ModelCardProps>
> = {
  ollama: SettingsProviderOllamaModelCard,
  openrouter: SettingsProviderOpenrouterModelCard,
  mistral: SettingsProviderMistralModelCard,
};

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
  const [modelQuery, setModelQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [noTrainingOnly, setNoTrainingOnly] = useState(false);
  const visibleModels = model.models.filter((item) => {
    const query = modelQuery.trim().toLocaleLowerCase();
    const matchesQuery =
      !query ||
      item.name.toLocaleLowerCase().includes(query) ||
      item.id.toLocaleLowerCase().includes(query);
    const isFree = [
      item.details.promptPrice,
      item.details.completionPrice,
      item.details.requestPrice,
    ].every((price) => Number(price ?? 0) === 0);
    return (
      matchesQuery &&
      (model.kind !== "openrouter" || !freeOnly || isFree) &&
      (model.kind !== "openrouter" ||
        !noTrainingOnly ||
        item.details.doesNotTrain === true ||
        item.details.zeroDataRetention === true)
    );
  });
  const save = async () => {
    setSaving(true);
    try {
      await textProviderStore.upsert({
        id: model.id ?? undefined,
        kind: model.kind,
        providerType: model.providerType,
        name: model.name,
        baseUrl: model.baseUrl,
        apiKeySecretId: model.apiKeySecretId ? model.apiKeySecretId : undefined,
        enabled: model.enabled,
        enabledModelIds: model.models
          .filter((item) => item.enabled)
          .map((item) => item.id),
        generationSettings: model.generationSettings,
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
    <ScrollArea
      data-tour="provider-form"
      className="min-h-0 min-w-0 flex-1 rounded-xl bg-main-800/40"
    >
      <div className="p-5">
        <ProvidedEntityManageHeader
          model={model}
          description={
            model.checkedAt
              ? `Проверен ${new Date(model.checkedAt).toLocaleTimeString("ru-RU")}`
              : "Подключение ещё не проверено"
          }
          canTest={!!model.baseUrl.trim()}
          canSave={canSave}
          onTest={onTestConnection}
          onSave={save}
          saving={saving}
          checking={checking}
        />
        <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <Lead
            title="Подключение"
            description="Настройки подключения к провайдеру."
          />
          <div
            data-tour="provider-connection-fields"
            className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2"
          >
            <Field label="Название">
              <InputSmall
                value={model.name}
                onChange={(event) => onChange({ name: event.target.value })}
              />
            </Field>
            <Field label="Поставщик модели">
              <Select
                searchable
                className="w-full"
                value={model.kind}
                onChange={(value) => {
                  const kind = value as TextProviderKind;
                  onConnectionChange({
                    kind,
                    baseUrl: BASE_URLS[kind],
                    apiKeySecretId: "",
                    limits: null,
                  });
                }}
                options={[
                  { value: "ollama", label: "Ollama" },
                  { value: "openrouter", label: "OpenRouter" },
                  { value: "mistral", label: "Mistral" },
                ]}
                classNames={{ search: "mb-3" }}
              >
                <Select.Trigger className="w-full" />
                <Select.Menu>
                  <Select.Option value="ollama" label="Ollama" />
                  <Select.Option value="openrouter" label="OpenRouter" />
                  <Select.Option value="mistral" label="Mistral" />
                </Select.Menu>
              </Select>
            </Field>
            <Field label="Base API URL" className="md:col-span-2">
              <InputSmall
                value={model.baseUrl}
                onChange={(event) =>
                  onConnectionChange({ baseUrl: event.target.value })
                }
                placeholder="Введите URL..."
              />
            </Field>
            <Field
              label={`Ключ API${model.kind === "openrouter" ? "" : " (необязательно)"}`}
              className="md:col-span-2"
            >
              <SecretOrientedSelect
                categoryId={SYSTEM_SECRET_CATEGORY_IDS.apiKeys}
                value={model.apiKeySecretId}
                onChange={(apiKeySecretId) =>
                  onConnectionChange({ apiKeySecretId })
                }
                placeholder="Выберите ключ или оставьте поле пустым..."
                searchable
                searchPlaceholder="Найти ключ"
                className="w-full"
                menuWidth="auto"
              />
            </Field>
            {model.kind === "openrouter" && model.limits ? (
              <OpenRouterLimits limits={model.limits} />
            ) : null}
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
          {model.providerType === "text" ? (
            <>
              <Lead
                title="Генерация"
                description="Параметры генерации ответа"
              />
              <div
                data-tour="provider-generation-fields"
                className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-3"
              >
                <Field
                  label={
                    <ParameterLabel description="Верхняя граница длины одного ответа модели. Чем выше значение, тем больше потенциальная стоимость запроса и расход доступного лимита. Для OpenRouter значение дополнительно ограничивается максимумом выбранной модели.">
                      Максимум токенов ответа
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    type="number"
                    min={1}
                    max={131072}
                    value={model.generationSettings.maxOutputTokens}
                    onChange={(event) =>
                      onChange({
                        generationSettings: {
                          ...model.generationSettings,
                          maxOutputTokens: clampNumber(
                            event.target.value,
                            1,
                            131072,
                          ),
                        },
                      })
                    }
                  />
                </Field>
                <Field
                  label={
                    <ParameterLabel description="Управляет случайностью генерации: низкие значения делают ответы более предсказуемыми и точными, высокие — более разнообразными и творческими.">
                      Температура
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={model.generationSettings.temperature}
                    onChange={(event) =>
                      onChange({
                        generationSettings: {
                          ...model.generationSettings,
                          temperature: clampNumber(event.target.value, 0, 2),
                        },
                      })
                    }
                  />
                </Field>
                <Field
                  label={
                    <ParameterLabel description="Ограничивает выбор токенов наиболее вероятной частью распределения. Обычно достаточно менять либо Top P, либо температуру, не оба параметра одновременно.">
                      Top P
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={model.generationSettings.topP}
                    onChange={(event) =>
                      onChange({
                        generationSettings: {
                          ...model.generationSettings,
                          topP: clampNumber(event.target.value, 0, 1),
                        },
                      })
                    }
                  />
                </Field>
                {model.kind === "openrouter" && (
                  <Alert
                    variant="info"
                    title="Лимит OpenRouter"
                    className="md:col-span-3"
                  >
                    Лимит ответа применяется к каждому запросу и дополнительно
                    ограничивается возможностями выбранной модели. Уменьшите его
                    при ошибке нехватки кредитов.
                  </Alert>
                )}
              </div>
            </>
          ) : null}
          <Lead
            title="Модели"
            description="Список доступных моделей провайдера."
          />
          <div
            data-tour="provider-models"
            className="rounded-xl bg-main-800/35 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-main-500">
                {visibleModels.length === model.models.length
                  ? `Доступно: ${model.models.length}`
                  : `Показано: ${visibleModels.length} из ${model.models.length}`}
              </span>
              <div className="flex items-center gap-2">
                {model.models.length ? (
                  <InputSmall
                    preset="search"
                    value={modelQuery}
                    onChange={(event) => setModelQuery(event.target.value)}
                    placeholder="Найти модель"
                    className="w-56"
                  />
                ) : null}
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
            </div>
            {model.kind === "openrouter" && model.models.length ? (
              <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-main-700/30 pt-3">
                <InputCheckBox
                  checked={freeOnly}
                  onChange={setFreeOnly}
                  className="whitespace-nowrap text-xs text-main-300"
                >
                  Только бесплатные
                </InputCheckBox>
                <InputCheckBox
                  checked={noTrainingOnly}
                  onChange={setNoTrainingOnly}
                  className="whitespace-nowrap text-xs text-main-300"
                >
                  Не использует данные для обучения
                </InputCheckBox>
              </div>
            ) : null}
            {visibleModels.length ? (
              <div className="space-y-2">
                {visibleModels.map((item) => {
                  const CardComponent = PROVIDER_CARDS[model.kind];
                  if (!CardComponent) return null;

                  return (
                    <CardComponent
                      key={item.id}
                      model={item}
                      enabled={item.enabled}
                      onEnabledChange={(enabled) =>
                        onModelChange(item.id, enabled)
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="grid min-h-36 place-items-center rounded-lg border border-dashed border-main-700 px-6 text-center text-sm text-main-500">
                {model.models.length &&
                (modelQuery.trim() || freeOnly || noTrainingOnly)
                  ? "Модели не соответствуют выбранным фильтрам. Синхронизируйте список, если провайдер был проверен до добавления фильтров."
                  : model.status === "error"
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

function clampNumber(value: string, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : min;
}

function OpenRouterLimits({ limits }: { limits: TextProviderLimits }) {
  const money = (value: number | null) =>
    value === null
      ? "Без ограничения"
      : `$${value.toLocaleString("ru-RU", { maximumFractionDigits: 4 })}`;
  return (
    <div className="md:col-span-2 grid gap-3 rounded-xl bg-main-700/20 p-4 sm:grid-cols-3">
      <div>
        <p className="text-[14px] text-main-500">Остаток лимита</p>
        <p className="mt-1 text-base font-semibold text-accent-light">
          {money(limits.limitRemaining)}
        </p>
      </div>
      <div>
        <p className="text-[14px] text-main-500">Использовано</p>
        <p className="mt-1 text-base font-semibold text-main-100">
          {money(limits.usage)}
        </p>
      </div>
      <div>
        <p className="text-[14px] text-main-500">Период сброса</p>
        <p className="mt-1 text-sm font-medium text-main-200">
          {limits.limitReset ?? "Не задан"}
        </p>
      </div>
      <p className="sm:col-span-3 text-[11px] text-main-500">
        За день: {money(limits.usageDaily)} · за неделю:{" "}
        {money(limits.usageWeekly)} · за месяц: {money(limits.usageMonthly)}
        {limits.isFreeTier ? " · бесплатный тариф" : ""}
      </p>
    </div>
  );
}
