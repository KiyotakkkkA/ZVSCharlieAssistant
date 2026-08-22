import {
  InputCheckSlided,
  InputSmall,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { UpsertIntegrationProfileInput } from "../../../../../shared/dto";
import { SYSTEM_SECRET_CATEGORY_IDS } from "../../../../../shared/entity-ids";
import type { IntegrationConnectionMetadata } from "../../../../../shared/models/integration";
import { Field, Lead, SecretOrientedSelect } from "../../../atoms";

interface SettingsIntegrationsConnectorsFormProps {
  value: UpsertIntegrationProfileInput;
  onChange(value: UpsertIntegrationProfileInput): void;
  connectionMetadata?: IntegrationConnectionMetadata;
}

export function SettingsIntegrationsConnectorsForm({
  value,
  onChange,
  connectionMetadata,
}: SettingsIntegrationsConnectorsFormProps) {
  const provider = value.kind === "gitlab_connector" ? "gitlab" : "github";
  const patch = (changes: Partial<UpsertIntegrationProfileInput>) =>
    onChange({ ...value, ...changes });
  const patchConfig = (
    changes: Partial<UpsertIntegrationProfileInput["config"]>,
  ) => patch({ config: { ...value.config, ...changes } });

  const changeProvider = (next: "github" | "gitlab") =>
    patch({
      kind: next === "github" ? "github_connector" : "gitlab_connector",
      config: {
        ...value.config,
        connectorProvider: next,
        repositoryUrl: "",
      },
    });

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
      <Lead
        title="Подключение"
        description="Доступ к репозиториям и данным системы контроля версий."
      />
      <div className="grid gap-4 rounded-xl bg-main-800/35 p-4 md:grid-cols-2">
        <Field label="Название">
          <InputSmall
            value={value.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </Field>
        <Field label="Поставщик коннектора">
          <Select
            value={provider}
            onChange={(next) => changeProvider(next as "github" | "gitlab")}
            options={[
              { value: "github", label: "GitHub" },
              { value: "gitlab", label: "GitLab" },
            ]}
            className="w-full"
          >
            <Select.Trigger className="w-full" />
            <Select.Menu>
              <Select.Option value="github" label="GitHub" />
              <Select.Option value="gitlab" label="GitLab" />
            </Select.Menu>
          </Select>
        </Field>
        <Field className="md:col-span-2" label="Адрес репозитория">
          <InputSmall
            value={value.config.repositoryUrl ?? ""}
            onChange={(event) =>
              patchConfig({ repositoryUrl: event.target.value })
            }
            placeholder={
              provider === "github"
                ? "https://github.com/owner/repository"
                : "https://gitlab.com/group/repository"
            }
          />
        </Field>
        <Field className="md:col-span-2" label="Токен доступа (необязательно)">
          <SecretOrientedSelect
            categoryId={SYSTEM_SECRET_CATEGORY_IDS.apiKeys}
            value={String(value.secretBindings.accessToken ?? "")}
            onChange={(secretId) =>
              patch({
                secretBindings: {
                  ...value.secretBindings,
                  accessToken: secretId,
                },
              })
            }
            className="w-full"
            placeholder="Выберите секрет"
          />
        </Field>
        {connectionMetadata?.repository ? (
          <RepositoryInfo metadata={connectionMetadata.repository} />
        ) : null}
        <div className="md:col-span-2 flex items-center justify-between rounded-lg bg-main-700/20 p-3">
          <div>
            <p className="text-sm font-medium text-main-200">
              Интеграция включена
            </p>
            <p className="mt-1 text-xs text-main-500">
              После сохранения коннектор будет доступен приложению.
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

function RepositoryInfo({
  metadata,
}: {
  metadata: NonNullable<IntegrationConnectionMetadata["repository"]>;
}) {
  const visibility =
    metadata.visibility === "private" ? "Приватный" : "Публичный";
  const updatedAt = metadata.updatedAt
    ? new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(metadata.updatedAt))
    : "Неизвестно";

  return (
    <div className="md:col-span-2 rounded-xl bg-main-700/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RepositoryInfoItem label="Репозиторий" value={metadata.fullName} />
        <RepositoryInfoItem label="Доступ" value={visibility} />
        <RepositoryInfoItem
          label="Основная ветка"
          value={metadata.defaultBranch ?? "Не задана"}
        />
        <RepositoryInfoItem label="Обновлён" value={updatedAt} />
        <RepositoryInfoItem
          label="Язык"
          value={metadata.language ?? "Не определён"}
        />
        <RepositoryInfoItem
          label="Звёзды"
          value={String(metadata.stars ?? 0)}
        />
        <RepositoryInfoItem label="Форки" value={String(metadata.forks ?? 0)} />
        <RepositoryInfoItem
          label="Открытые задачи"
          value={String(metadata.openIssues ?? 0)}
        />
      </div>
      {metadata.description ? (
        <p className="mt-3 text-xs leading-5 text-main-400">
          {metadata.description}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-main-700/40 pt-3">
        <span className="text-xs text-main-500">Ветки:</span>
        {metadata.branches.length ? (
          metadata.branches.map((branch) => (
            <span
              key={branch}
              className="rounded-md bg-main-700/55 px-2 py-1 text-xs text-main-200"
            >
              {branch}
            </span>
          ))
        ) : (
          <span className="text-xs text-main-500">не получены</span>
        )}
      </div>
    </div>
  );
}

function RepositoryInfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-main-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-main-100">
        {value}
      </p>
    </div>
  );
}
