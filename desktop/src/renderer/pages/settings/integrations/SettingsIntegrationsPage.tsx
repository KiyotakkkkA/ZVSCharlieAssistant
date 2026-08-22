import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { ScrollArea, Tabs, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { PrimaryButton } from "../../../components/atoms/buttons";
import {
  ProvidedEntityManageHeader,
  ProvidedEntitySidebarCard,
} from "../../../components/molecules";
import { PageHeader } from "../../../components/organisms";
import {
  SettingsIntegrationsBotsForm,
  SettingsIntegrationsConnectorsForm,
  SettingsIntegrationsMailForm,
} from "../../../components/organisms/forms";
import { DangerModal } from "../../../components/organisms/modals";
import { integrationStore } from "../../../stores";
import type {
  IntegrationConnectionMetadata,
  IntegrationKind,
  IntegrationProfile,
} from "../../../../shared/models/integration";
import type { UpsertIntegrationProfileInput } from "../../../../shared/dto";
import { ProvidedEntityStatus } from "src/shared/dto/shared";

const MAPPING: Record<
  IntegrationKind,
  {
    label: string;
    emptyStateLabel: string;
    emptyStateConfig: Record<string, unknown>;
  }
> = {
  telegram_bot: {
    label: "Бот · Telegram",
    emptyStateLabel: "Новый бот · Telegram",
    emptyStateConfig: { botProvider: "telegram" },
  },
  email_imap: {
    label: "Почта · IMAP",
    emptyStateLabel: "Новая почта · IMAP",
    emptyStateConfig: {
      port: 993,
      secure: true,
      mailbox: "INBOX",
      smtpPort: 465,
      smtpSecure: true,
    },
  },
  github_connector: {
    label: "Коннектор · GitHub",
    emptyStateLabel: "Новое подключение GitHub",
    emptyStateConfig: {
      connectorProvider: "github",
      repositoryUrl: "",
    },
  },
  gitlab_connector: {
    label: "Коннектор · GitLab",
    emptyStateLabel: "Новое подключение GitLab",
    emptyStateConfig: {
      connectorProvider: "gitlab",
      repositoryUrl: "",
    },
  },
};

type IntegrationTab = "bots" | "mail" | "connectors";

const TAB_KINDS: Record<IntegrationTab, IntegrationKind[]> = {
  bots: ["telegram_bot"],
  mail: ["email_imap"],
  connectors: ["github_connector", "gitlab_connector"],
};

const DEFAULT_KIND: Record<IntegrationTab, IntegrationKind> = {
  bots: "telegram_bot",
  mail: "email_imap",
  connectors: "github_connector",
};

const emptyInput = (kind: IntegrationKind): UpsertIntegrationProfileInput => ({
  kind,
  name: MAPPING[kind].emptyStateLabel,
  enabled: true,
  config: MAPPING[kind].emptyStateConfig,
  secretBindings: {},
});

export const SettingsIntegrationsPage = observer(
  function SettingsIntegrationsPage() {
    const toasts = useToasts();
    const [tab, setTab] = useState<IntegrationTab>("bots");
    const profiles = integrationStore.profiles.filter((item) =>
      TAB_KINDS[tab].includes(item.kind),
    );
    const [selectedId, setSelectedId] = useState<string | "draft" | null>(null);
    const [checking, setChecking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draftStatus, setDraftStatus] =
      useState<ProvidedEntityStatus>("unchecked");
    const [draftConnectionMetadata, setDraftConnectionMetadata] =
      useState<IntegrationConnectionMetadata>({});
    const [profileToDelete, setProfileToDelete] =
      useState<IntegrationProfile | null>(null);
    const selected = profiles.find(
      (item) => item.id === (selectedId === "draft" ? null : selectedId),
    );
    const [draft, setDraft] = useState<UpsertIntegrationProfileInput>(() =>
      emptyInput(DEFAULT_KIND[tab]),
    );

    useEffect(() => {
      setSelectedId(profiles[0]?.id ?? null);
    }, [tab]);
    useEffect(() => {
      if (selectedId === "draft") return;
      setDraftStatus(selected?.status ?? "unchecked");
      setDraftConnectionMetadata(selected?.connectionMetadata ?? {});
      setDraft(
        selected
          ? {
              id: selected.id,
              kind: selected.kind,
              name: selected.name,
              enabled: selected.enabled,
              config: { ...selected.config },
              secretBindings: { ...selected.secretBindings },
            }
          : emptyInput(DEFAULT_KIND[tab]),
      );
    }, [selectedId, selected?.updatedAt, tab]);

    const createProfile = () => {
      setDraft(emptyInput(DEFAULT_KIND[tab]));
      setDraftStatus("unchecked");
      setDraftConnectionMetadata({});
      setSelectedId("draft");
    };

    const updateDraft = (value: UpsertIntegrationProfileInput) => {
      setDraft(value);
      if (selectedId === "draft") setDraftStatus("unchecked");
    };

    const save = async () => {
      setSaving(true);
      try {
        const saved = await integrationStore.upsert(draft);
        if (!draft.id && draftStatus !== "unchecked") {
          await window.desktop.integrations.test({ ...draft, id: saved.id });
          await integrationStore.bootstrap(true);
        }
        setSelectedId(saved.id);
        toasts.success({ title: "Интеграция сохранена" });
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
    const test = async () => {
      if (checking) return;
      setChecking(true);
      try {
        const result = await window.desktop.integrations.test(draft);
        setDraftStatus(result.ok ? "connected" : "error");
        setDraftConnectionMetadata(result.metadata ?? {});
        if (result.ok)
          toasts.success({
            title: "Подключение установлено",
            description: result.identity,
          });
        else
          toasts.danger({
            title: "Подключение не установлено",
            description: result.error,
          });
        if (draft.id) await integrationStore.bootstrap(true);
      } catch (error) {
        setDraftStatus("error");
        toasts.danger({
          title: "Не удалось проверить подключение",
          description:
            error instanceof Error ? error.message : "Неизвестная ошибка",
        });
      } finally {
        setChecking(false);
      }
    };

    const profileCount = (kind: IntegrationKind) =>
      integrationStore.profiles.filter((profile) => profile.kind === kind)
        .length + (selectedId === "draft" && draft.kind === kind ? 1 : 0);

    return (
      <section className="flex h-full min-h-0 flex-col p-4">
        <PageHeader
          title="Интеграции"
          description="Использование возможностей внешних систем"
          breadcrumbs={[{ label: "Настройки" }, { label: "Интеграции" }]}
          footer={
            <Tabs
              value={tab}
              onChange={(value) => setTab(value as typeof tab)}
              options={[
                {
                  value: "bots",
                  label: `Боты · ${profileCount("telegram_bot")}`,
                },
                {
                  value: "mail",
                  label: `Почта · ${profileCount("email_imap")}`,
                },
                {
                  value: "connectors",
                  label: `Коннекторы данных · ${profileCount("github_connector") + profileCount("gitlab_connector")}`,
                },
              ]}
            />
          }
        >
          <PrimaryButton
            variant="create"
            label="Добавить профиль"
            onClick={createProfile}
          />
        </PageHeader>
        <div className="flex min-h-0 flex-1 gap-3">
          <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-xl bg-main-800/40">
            <div className="border-b border-main-700/35 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-main-500">
              Подключения · {profiles.length + (selectedId === "draft" ? 1 : 0)}
            </div>
            <ScrollArea className="min-h-0 flex-1 p-2">
              <div className="space-y-1.5">
                <ProvidedEntitySidebarCard
                  model={
                    selectedId === "draft"
                      ? {
                          id: null,
                          kind: draft.kind,
                          name: draft.name,
                          status: draftStatus,
                        }
                      : null
                  }
                  description={MAPPING[draft.kind].label}
                  active={selectedId === "draft"}
                  onClick={() => setSelectedId("draft")}
                  deleteTitle="Удалить интеграцию"
                />
                {profiles.map((profile) => (
                  <ProvidedEntitySidebarCard
                    key={profile.id}
                    model={profile}
                    description={MAPPING[profile.kind].label}
                    active={profile.id === selectedId}
                    onClick={() => setSelectedId(profile.id)}
                    onDelete={() => setProfileToDelete(profile)}
                    deleteTitle="Удалить интеграцию"
                  />
                ))}
                {!profiles.length && selectedId !== "draft" ? (
                  <p className="p-5 text-center text-sm text-main-500">
                    Подключений пока нет
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          </aside>
          <div className="space-y-5 p-5 bg-main-800/40 rounded-xl w-full">
            <ProvidedEntityManageHeader
              model={draft}
              onTest={test}
              onSave={save}
              saving={saving}
              checking={checking}
            />
            {draft.kind === "telegram_bot" ? (
              <SettingsIntegrationsBotsForm
                value={draft}
                onChange={updateDraft}
                connectionMetadata={draftConnectionMetadata}
              />
            ) : draft.kind === "email_imap" ? (
              <SettingsIntegrationsMailForm
                value={draft}
                onChange={updateDraft}
              />
            ) : (
              <SettingsIntegrationsConnectorsForm
                value={draft}
                onChange={updateDraft}
                connectionMetadata={draftConnectionMetadata}
              />
            )}
          </div>
        </div>
        <DangerModal
          open={profileToDelete !== null}
          model={profileToDelete}
          title="Удалить интеграцию?"
          description={(profile) => (
            <>
              Подключение «
              <strong className="font-semibold text-main-50">
                {profile.name}
              </strong>
              » и его привязки к триггерам будут удалены.
            </>
          )}
          onCancel={() => setProfileToDelete(null)}
          onConfirm={async (profile) => {
            await integrationStore.remove(profile.id);
            if (selectedId === profile.id) setSelectedId(null);
            setProfileToDelete(null);
            toasts.success({ title: "Интеграция удалена" });
          }}
        />
      </section>
    );
  },
);
