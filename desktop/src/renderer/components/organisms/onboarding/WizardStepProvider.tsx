import {
  Alert,
  Button,
  InputSmall,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import type { TextProviderKind } from "../../../../shared/dto";
import type { TextProviderModelInfo } from "../../../../shared/models/text-provider";
import { SYSTEM_SECRET_CATEGORY_IDS } from "../../../../shared/entity-ids";
import {
  secretStorageStore,
  textProviderStore,
} from "../../../stores";
import { CheckIcon, RefreshIcon, RobotIcon } from "../../atoms";

const PROVIDERS: Record<
  TextProviderKind,
  { label: string; baseUrl: string; keyRequired: boolean }
> = {
  ollama: {
    label: "Ollama",
    baseUrl: "http://localhost:11434",
    keyRequired: false,
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyRequired: true,
  },
  mistral: {
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyRequired: true,
  },
};

export const WizardStepProvider = observer(function WizardStepProvider() {
  const [kind, setKind] = useState<TextProviderKind>("ollama");
  const [baseUrl, setBaseUrl] = useState(PROVIDERS.ollama.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySecretId, setApiKeySecretId] = useState<string | undefined>();
  const [models, setModels] = useState<TextProviderModelInfo[]>([]);
  const [modelId, setModelId] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeKind = (next: TextProviderKind) => {
    setKind(next);
    setBaseUrl(PROVIDERS[next].baseUrl);
    setApiKey("");
    setApiKeySecretId(undefined);
    setModels([]);
    setModelId("");
    setError(null);
  };

  const createApiKeySecret = async (): Promise<string | undefined> => {
    if (apiKeySecretId) return apiKeySecretId;
    if (!apiKey.trim()) return undefined;
    const secret = await secretStorageStore.upsertSecret({
      categoryId: SYSTEM_SECRET_CATEGORY_IDS.apiKeys,
      label: `${PROVIDERS[kind].label} · руководство`,
      content: apiKey.trim(),
    });
    setApiKeySecretId(secret.id);
    return secret.id;
  };

  const testConnection = async () => {
    if (!baseUrl.trim() || (PROVIDERS[kind].keyRequired && !apiKey.trim())) {
      setError(
        PROVIDERS[kind].keyRequired
          ? "Укажите адрес и ключ API."
          : "Укажите адрес сервера Ollama.",
      );
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const apiKeySecretId = await createApiKeySecret();
      const result = await window.desktop.textProviders.testConnection({
        kind,
        providerType: "text",
        baseUrl: baseUrl.trim(),
        apiKeySecretId,
      });
      setModels(result.models);
      setModelId(result.models[0]?.id ?? "");
      if (!result.models.length) {
        setError("Подключение установлено, но провайдер не вернул модели.");
      }
    } catch (reason) {
      setModels([]);
      setModelId("");
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось проверить подключение.",
      );
    } finally {
      setChecking(false);
    }
  };

  const save = async () => {
    if (!modelId) return;
    setSaving(true);
    setError(null);
    try {
      const apiKeySecretId = await createApiKeySecret();
      await textProviderStore.upsert({
        kind,
        providerType: "text",
        name: PROVIDERS[kind].label,
        baseUrl: baseUrl.trim(),
        apiKeySecretId,
        enabled: true,
        enabledModelIds: [modelId],
        generationSettings: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.9,
        },
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось сохранить провайдера.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (textProviderStore.enabledModels.length) {
    return (
      <div className="grid min-h-72 place-items-center text-center">
        <div className="max-w-md">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-success-medium/15 text-success-light">
            <CheckIcon className="size-6" />
          </span>
          <h2 className="mt-4 text-xl font-semibold text-main-50">
            Модель готова к работе
          </h2>
          <p className="mt-2 text-sm leading-6 text-main-400">
            Включено моделей: {textProviderStore.enabledModels.length}. Чат и
            агенты уже могут использовать это подключение.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
            <RobotIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-main-50">
              Подключите первую модель
            </h2>
            <p className="mt-1 text-sm text-main-400">
              Проверим соединение и сразу включим выбранную модель.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl bg-main-800/45 p-4 ring-1 ring-main-700/40 sm:grid-cols-2">
        <label className="block text-xs font-medium text-main-300">
          Провайдер
          <Select
            className="mt-2 w-full"
            value={kind}
            onChange={(value) => changeKind(value as TextProviderKind)}
            options={Object.entries(PROVIDERS).map(([value, item]) => ({
              value,
              label: item.label,
            }))}
          >
            <Select.Trigger className="w-full" />
            <Select.Menu>
              {Object.entries(PROVIDERS).map(([value, item]) => (
                <Select.Option key={value} value={value} label={item.label} />
              ))}
            </Select.Menu>
          </Select>
        </label>
        <label className="block text-xs font-medium text-main-300">
          Адрес API
          <InputSmall
            className="mt-2 w-full"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value);
              setModels([]);
            }}
          />
        </label>
        {PROVIDERS[kind].keyRequired ? (
          <label className="block text-xs font-medium text-main-300 sm:col-span-2">
            Ключ API
            <InputSmall
              type="password"
              className="mt-2 w-full"
              value={apiKey}
              placeholder="Ключ будет сохранён в защищённом хранилище"
              onChange={(event) => {
                setApiKey(event.target.value);
                setApiKeySecretId(undefined);
                setModels([]);
              }}
            />
          </label>
        ) : null}
        {models.length ? (
          <label className="block text-xs font-medium text-main-300 sm:col-span-2">
            Модель для чата
            <Select
              searchable
              className="mt-2 w-full"
              value={modelId}
              onChange={setModelId}
              options={models.map((model) => ({
                value: model.id,
                label: model.name,
              }))}
            >
              <Select.Trigger className="w-full" />
              <Select.Menu>
                {models.map((model) => (
                  <Select.Option
                    key={model.id}
                    value={model.id}
                    label={model.name}
                  />
                ))}
              </Select.Menu>
            </Select>
          </label>
        ) : null}
      </div>

      {error ? (
        <Alert variant="warning" title="Нужна проверка">
          {error}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          rounded="rounded-full"
          className="px-2"
          loading={checking}
          disabled={saving}
          onClick={() => void testConnection()}
        >
          <RefreshIcon className="size-4" />
          Проверить подключение
        </Button>
        {models.length ? (
          <Button
            variant="primary"
            rounded="rounded-full"
            className="px-2"
            loading={saving}
            disabled={!modelId || checking}
            onClick={() => void save()}
          >
            <CheckIcon className="size-4" />
            Сохранить и включить
          </Button>
        ) : null}
      </div>
    </div>
  );
});
