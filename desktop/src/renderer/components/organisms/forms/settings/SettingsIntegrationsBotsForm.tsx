import {
  InputCheckSlided,
  InputSmall,
} from "@kiyotakkkka/zvs-uikit-lib";
import { BasicSelect } from "../../../atoms/basic";
import type { UpsertIntegrationProfileInput } from "../../../../../shared/dto";
import { SYSTEM_SECRET_CATEGORY_IDS } from "../../../../../shared/entity-ids";
import type { IntegrationConnectionMetadata } from "../../../../../shared/models/integration";
import {
  Field,
  Lead,
  SecretOrientedSelect,
} from "../../../atoms";

interface SettingsIntegrationsBotsFormProps {
  value: UpsertIntegrationProfileInput;
  onChange(value: UpsertIntegrationProfileInput): void;
  connectionMetadata?: IntegrationConnectionMetadata;
}

export function SettingsIntegrationsBotsForm({
  value,
  onChange,
  connectionMetadata,
}: SettingsIntegrationsBotsFormProps) {
  const patch = (changes: Partial<UpsertIntegrationProfileInput>) =>
    onChange({ ...value, ...changes });
  const patchConfig = (
    changes: Partial<UpsertIntegrationProfileInput["config"]>,
  ) => patch({ config: { ...value.config, ...changes } });

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
      <Lead
        title="Подключение"
        description="Настройки подключения к провайдеру."
      />
      <div
        data-tour="integration-connection-fields"
        className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2"
      >
        <Field
          label="
            Название"
        >
          <InputSmall
            value={value.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>

        <Field label="Поставщик бота">
          <BasicSelect
            value={value.config.botProvider ?? "telegram"}
            onChange={() => patchConfig({ botProvider: "telegram" })}
            options={[{ value: "telegram", label: "Telegram" }]}
            className="w-full"
          />
        </Field>

        <Field className="col-span-2" label="Токен бота">
          <SecretOrientedSelect
            categoryId={SYSTEM_SECRET_CATEGORY_IDS.apiKeys}
            value={String(value.secretBindings.botToken ?? "")}
            onChange={(secretId) =>
              patch({
                secretBindings: {
                  ...value.secretBindings,
                  botToken: secretId,
                },
              })
            }
            className="w-full"
            placeholder="Выберите секрет"
          />
        </Field>

        {connectionMetadata?.telegram ? (
          <div className="col-span-2 grid grid-cols-3 gap-3 rounded-xl bg-main-700/20 p-4">
            <BotInfo
              label="Бот"
              value={connectionMetadata.telegram.firstName ?? "Без имени"}
            />
            <BotInfo
              label="Имя пользователя"
              value={
                connectionMetadata.telegram.username
                  ? `@${connectionMetadata.telegram.username}`
                  : "Не задано"
              }
            />
            <BotInfo
              label="Telegram ID"
              value={String(connectionMetadata.telegram.id)}
            />
            <p className="col-span-3 text-xs text-main-500">
              {connectionMetadata.telegram.canJoinGroups
                ? "Бот может получать события из групп, в которые он добавлен."
                : "Бот принимает события только в доступных ему личных чатах."}
            </p>
          </div>
        ) : null}

        <div className="col-span-2 flex items-center justify-between rounded-lg bg-main-700/20 p-3">
          <div>
            <p className="text-sm font-medium text-main-200">
              Интеграция включена
            </p>
            <p className="mt-1 text-xs text-main-500">
              После сохранения подключение будет доступно триггерам сценариев.
            </p>
          </div>
          <InputCheckSlided
            checked={value.enabled}
            onChange={(enabled) => patch({ enabled })}
          />
        </div>
      </div>
    </div>
  );
}

function BotInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[14px] text-main-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-main-100">
        {value}
      </p>
    </div>
  );
}
