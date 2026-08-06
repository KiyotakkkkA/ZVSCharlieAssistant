import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  ScrollArea,
  Tabs,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { MailIcon, TelegramIcon } from "../../../components/atoms";
import {
  ControlButton,
  PrimaryButton,
} from "../../../components/atoms/buttons";
import { PageHeader } from "../../../components/organisms";
import {
  SettingsIntegrationsBotsForm,
  SettingsIntegrationsMailForm,
} from "../../../components/organisms/forms";
import { DangerModal } from "../../../components/organisms/modals";
import { integrationStore } from "../../../stores";
import type {
  IntegrationConnectionMetadata,
  IntegrationKind,
  IntegrationProfile,
  IntegrationStatus,
} from "../../../../shared/models/integration";
import type { UpsertIntegrationProfileInput } from "../../../../shared/dto";

const emptyInput = (kind: IntegrationKind): UpsertIntegrationProfileInput => ({
  kind,
  name: kind === "telegram_bot" ? "Новый Telegram-бот" : "Новая почта",
  enabled: true,
  config:
    kind === "email_imap"
      ? { port: 993, secure: true, mailbox: "INBOX" }
      : { botProvider: "telegram" },
  secretBindings: {},
});

export const SettingsIntegrationsPage = observer(
  function SettingsIntegrationsPage() {
    const toasts = useToasts();
    const [tab, setTab] = useState<"telegram_bot" | "email_imap">(
      "telegram_bot",
    );
    const profiles = integrationStore.profiles.filter(
      (item) => item.kind === tab,
    );
    const [selectedId, setSelectedId] = useState<number | "draft" | null>(null);
    const [checking, setChecking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draftStatus, setDraftStatus] =
      useState<IntegrationStatus>("unchecked");
    const [draftConnectionMetadata, setDraftConnectionMetadata] =
      useState<IntegrationConnectionMetadata>({});
    const [profileToDelete, setProfileToDelete] =
      useState<IntegrationProfile | null>(null);
    const selected = profiles.find(
      (item) => item.id === (selectedId === "draft" ? null : selectedId),
    );
    const [draft, setDraft] = useState<UpsertIntegrationProfileInput>(() =>
      emptyInput(tab),
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
          : emptyInput(tab),
      );
    }, [selectedId, selected?.updatedAt, tab]);

    const createProfile = () => {
      setDraft(emptyInput(tab));
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
          description="Переиспользуемые подключения для автоматических запусков сценариев. Секреты хранятся отдельно."
          breadcrumbs={[
            { label: "Настройки", to: APP_PATHS.settings.providers },
            { label: "Интеграции" },
          ]}
          footer={
            <Tabs
              value={tab}
              onChange={(value) => setTab(value as typeof tab)}
              options={[
                {
                  value: "telegram_bot",
                  label: `Боты · ${profileCount("telegram_bot")}`,
                },
                {
                  value: "email_imap",
                  label: `Почта · ${profileCount("email_imap")}`,
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
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-3 pt-4">
          <aside className="min-h-0 rounded-xl bg-main-800/35 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-main-500">
              Подключения · {profiles.length + (selectedId === "draft" ? 1 : 0)}
            </p>
            <ScrollArea className="h-[calc(100%-2rem)]">
              <div className="space-y-2">
                {selectedId === "draft" ? (
                  <ProfileButton
                    profile={{
                      kind: draft.kind,
                      name: draft.name,
                      status: draftStatus,
                    }}
                    active
                    onClick={() => setSelectedId("draft")}
                  />
                ) : null}
                {profiles.map((profile) => (
                  <ProfileButton
                    key={profile.id}
                    profile={profile}
                    active={profile.id === selectedId}
                    onClick={() => setSelectedId(profile.id)}
                    onDelete={() => setProfileToDelete(profile)}
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
          <ScrollArea className="min-h-0 rounded-xl bg-main-800/25">
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-between border-b border-main-700 pb-4">
                <div>
                  <h2 className="font-semibold text-main-100">{draft.name}</h2>
                  <p className="text-xs text-main-500">
                    {draft.kind === "telegram_bot"
                      ? "Telegram Bot API"
                      : "Входящая почта по IMAP"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    rounded="rounded-full"
                    className="px-2"
                    loading={checking}
                    loadingText="Проверка…"
                    disabled={checking}
                    onClick={() => void test()}
                  >
                    Проверить подключение
                  </Button>
                  <PrimaryButton
                    variant="save"
                    label="Сохранить"
                    loading={saving}
                    disabled={saving}
                    onClick={() => void save()}
                  />
                </div>
              </div>
              {draft.kind === "telegram_bot" ? (
                <SettingsIntegrationsBotsForm
                  value={draft}
                  onChange={updateDraft}
                  connectionMetadata={draftConnectionMetadata}
                />
              ) : (
                <SettingsIntegrationsMailForm
                  value={draft}
                  onChange={updateDraft}
                />
              )}
            </div>
          </ScrollArea>
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

function ProfileButton({
  profile,
  active,
  onClick,
  onDelete,
}: {
  profile: Pick<IntegrationProfile, "kind" | "name" | "status">;
  active: boolean;
  onClick(): void;
  onDelete?(): void;
}) {
  const isTelegram = profile.kind === "telegram_bot";
  const status =
    profile.status === "connected"
      ? { label: "Подключено", className: "text-success-light" }
      : profile.status === "error"
        ? { label: "Ошибка подключения", className: "text-danger-light" }
        : profile.status === "disabled"
          ? { label: "Отключено", className: "text-main-500" }
          : { label: "Не проверено", className: "text-main-500" };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
      className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors ${active ? "bg-main-700/65" : "hover:bg-main-700/35"}`}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
        {isTelegram ? (
          <TelegramIcon className="size-5" />
        ) : (
          <MailIcon className="size-5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-main-100">
          {profile.name}
        </span>
        <span className="mt-1 block text-xs text-main-500">
          {isTelegram ? "Telegram · Bot API" : "Почта · IMAP"}
        </span>
        <span className={`mt-2 block text-[10px] ${status.className}`}>
          {status.label}
        </span>
      </span>
      {onDelete ? (
        <span onClick={(event) => event.stopPropagation()}>
          <ControlButton
            icon="trash"
            variant="delete"
            title="Удалить интеграцию"
            onClick={onDelete}
          />
        </span>
      ) : null}
    </div>
  );
}
