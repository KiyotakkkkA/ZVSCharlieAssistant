import { Alert, Badge, Button, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import { useCallback, useEffect, useState } from "react";
import type { ZvsIdConnection } from "../../../../../ipc/contracts";
import { GlobalSettingsLabel } from "../../../atoms";
import { ZVS_ANCHORS } from "./settings-sections";

const SCOPE_LABELS: Record<string, string> = {
  openid: "Идентификатор аккаунта",
  profile: "Профиль",
  email: "Электронная почта",
  offline_access: "Оффлайн-доступ",
};

export const GlobalSettingsZVSForm = () => {
  const toasts = useToasts();
  const [connection, setConnection] = useState<ZvsIdConnection | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void window.desktop.zvsId
      .status()
      .then((value) => {
        if (active) setConnection(value);
      })
      .catch(() => undefined);

    const release = window.desktop.zvsId.subscribe((value) => {
      if (active) setConnection(value);
    });

    return () => {
      active = false;
      release();
    };
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const result = await window.desktop.zvsId.connect();
      setConnection(result);
      toasts.success({
        title: "ZVS ID подключён",
        description: result.identity?.email ?? undefined,
      });
    } catch (error) {
      toasts.danger({
        title: "Не удалось подключить ZVS ID",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setBusy(false);
    }
  }, [toasts]);

  const disconnect = async () => {
    setBusy(true);
    try {
      setConnection(await window.desktop.zvsId.disconnect());
      toasts.success({ title: "ZVS ID отключён" });
    } catch (error) {
      toasts.danger({
        title: "Не удалось отключить ZVS ID",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setBusy(false);
    }
  };

  const connected = connection?.status === "connected";

  return (
    <section className="space-y-5">
      <GlobalSettingsLabel {...ZVS_ANCHORS.account} />
      {connection && !connection.encryptedAtRest && (
        <Alert variant="danger" rounded="rounded-lg" className="mb-4">
          Операционная система не предоставила безопасное хранилище — токены ZVS
          ID будут сохранены на диск без шифрования.
        </Alert>
      )}

      <div className="rounded-xl border border-main-700/60 bg-main-800/40 p-4">
        <div className="flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-main-700/70 bg-main-800 text-sm font-semibold text-main-200">
            {connected
              ? initials(
                  connection.identity?.displayName,
                  connection.identity?.email,
                )
              : "ZVS"}
          </span>

          <div className="min-w-0 grow">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-sm font-medium text-main-100">
                {connected
                  ? (connection.identity?.displayName ??
                    connection.identity?.email ??
                    "Аккаунт ZVS ID")
                  : "Аккаунт не подключён"}
              </h4>
              <Badge
                variant={connected ? "success" : "secondary"}
                rounded="rounded-full"
                size="sm"
              >
                {statusLabel(connection?.status)}
              </Badge>
            </div>

            <p className="mt-1 text-xs leading-5 text-main-400">
              {connected
                ? `${connection.identity?.email ?? "—"} · подключён ${formatDate(connection.connectedAt)}`
                : "После авторизации вы будете возвращены обратно в приложение."}
            </p>

            {connected && connection.scopes.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {connection.scopes.map((scope) => (
                  <li
                    key={scope}
                    className="rounded-md border border-main-700/70 bg-main-800 px-2 py-1 text-[11px] text-main-300"
                  >
                    {SCOPE_LABELS[scope] ?? scope}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-main-700/60 pt-4">
          {connected ? (
            <Button
              variant="danger"
              className="px-2"
              loading={busy}
              loadingText="Отключаем…"
              onClick={() => void disconnect()}
            >
              Отключить
            </Button>
          ) : (
            <Button
              variant="primary"
              className="px-2"
              loading={busy || connection?.status === "connecting"}
              loadingText="Ожидаем браузер…"
              disabled={connection?.clientConfigured === false}
              onClick={() => void connect()}
            >
              Подключить ZVS ID
            </Button>
          )}
        </div>
      </div>

      {connection && !connection.clientConfigured && (
        <Alert variant="warning" rounded="rounded-lg" className="mb-4">
          Приложение не зарегистрировано в ZVS ID.
        </Alert>
      )}
    </section>
  );
};

function statusLabel(status: ZvsIdConnection["status"] | undefined): string {
  switch (status) {
    case "connected":
      return "Подключено";
    case "connecting":
      return "Ожидание браузера";
    case "expired":
      return "Требуется вход";
    default:
      return "Не подключено";
  }
}

function initials(
  displayName: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = displayName?.trim() || email || "ZVS";
  const [first, second] = source.split(/[\s._@-]+/).filter(Boolean);
  if (first && second) return `${first[0]}${second[0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
