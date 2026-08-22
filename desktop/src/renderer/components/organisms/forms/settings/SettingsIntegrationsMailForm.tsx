import { InputCheckSlided, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import type { UpsertIntegrationProfileInput } from "../../../../../shared/dto";
import { SYSTEM_SECRET_CATEGORY_IDS } from "../../../../../shared/entity-ids";
import {
  Field,
  Lead,
  ParameterLabel,
  SecretOrientedSelect,
} from "../../../atoms";

interface SettingsIntegrationsMailFormProps {
  value: UpsertIntegrationProfileInput;
  onChange(value: UpsertIntegrationProfileInput): void;
}

export function SettingsIntegrationsMailForm({
  value,
  onChange,
}: SettingsIntegrationsMailFormProps) {
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
      <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2">
        <Field label="Название">
          <InputSmall
            value={value.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>
        <Field
          label={
            <ParameterLabel description="Адрес IMAP-сервера, с которого приложение получает входящие сообщения.">
              IMAP host
            </ParameterLabel>
          }
        >
          <InputSmall
            value={value.config.host ?? ""}
            onChange={(event) => patchConfig({ host: event.target.value })}
            placeholder="imap.example.com"
          />
        </Field>
        <Field label="SMTP host">
          <InputSmall
            value={value.config.smtpHost ?? ""}
            onChange={(event) => patchConfig({ smtpHost: event.target.value })}
            placeholder="smtp.example.com"
          />
        </Field>
        <Field label="SMTP порт">
          <InputSmall
            type="number"
            value={String(value.config.smtpPort ?? 465)}
            onChange={(event) =>
              patchConfig({ smtpPort: Number(event.target.value) })
            }
          />
        </Field>
        <Field label="Адрес отправителя">
          <InputSmall
            value={value.config.smtpFrom ?? value.config.username ?? ""}
            onChange={(event) => patchConfig({ smtpFrom: event.target.value })}
            placeholder="assistant@example.com"
          />
        </Field>
        <Field label="SMTP через TLS">
          <InputCheckSlided
            checked={value.config.smtpSecure ?? true}
            onChange={(smtpSecure) => patchConfig({ smtpSecure })}
          />
        </Field>
        <Field
          label={
            <ParameterLabel description="Порт IMAP-сервера. Для защищённого IMAP">
              Порт
            </ParameterLabel>
          }
        >
          <InputSmall
            type="number"
            value={String(value.config.port ?? 993)}
            onChange={(event) =>
              patchConfig({ port: Number(event.target.value) })
            }
          />
        </Field>
        <Field
          label={
            <ParameterLabel description="Логин почтового ящика, обычно полный адрес электронной почты.">
              Пользователь
            </ParameterLabel>
          }
        >
          <InputSmall
            value={value.config.username ?? ""}
            onChange={(event) => patchConfig({ username: event.target.value })}
          />
        </Field>
        <Field
          label={
            <ParameterLabel description="Папка, события из которой будут доступны почтовым триггерам. По умолчанию INBOX.">
              Папка
            </ParameterLabel>
          }
        >
          <InputSmall
            value={value.config.mailbox ?? "INBOX"}
            onChange={(event) => patchConfig({ mailbox: event.target.value })}
          />
        </Field>
        <Field
          label={
            <ParameterLabel description="Секрет с паролем приложения или паролем почтового ящика.">
              Пароль / app password
            </ParameterLabel>
          }
        >
          <SecretOrientedSelect
            categoryId={SYSTEM_SECRET_CATEGORY_IDS.apiKeys}
            value={String(value.secretBindings.password ?? "")}
            onChange={(secretId) =>
              patch({
                secretBindings: {
                  ...value.secretBindings,
                  password: secretId,
                },
              })
            }
            className="w-full"
            placeholder="Выберите секрет"
          />
        </Field>
        <Field
          label={
            <ParameterLabel description="Устанавливает зашифрованное TLS-соединение с IMAP-сервером.">
              Защищённое соединение
            </ParameterLabel>
          }
        >
          <InputCheckSlided
            checked={value.config.secure ?? true}
            onChange={(secure) => patchConfig({ secure })}
          />
        </Field>

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
