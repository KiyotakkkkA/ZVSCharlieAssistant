import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import { CodeView } from "@kiyotakkkka/zvs-uikit-lib/code-view";
import type { TerminalApprovalRequest } from "../../../../ipc/contracts";

const RISK_LABELS: Record<TerminalApprovalRequest["risk"], string> = {
  low: "низкий",
  medium: "средний",
  high: "высокий",
  critical: "критический",
};

const RISK_VARIANTS: Record<
  TerminalApprovalRequest["risk"],
  "info" | "warning" | "danger"
> = {
  low: "info",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

function formatRemaining(expiresAt: string, now: number): string | null {
  const left = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(left)) return null;
  if (left <= 0) return "срок истёк";
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1_000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function TerminalApprovalModal() {
  const [items, setItems] = useState<TerminalApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const current = items[0];

  const refresh = useCallback(
    () =>
      window.desktop.terminalPolicy
        .pendingApprovals()
        .then(setItems)
        .catch(() =>
          setError(
            "Не удалось получить список команд, ожидающих подтверждения",
          ),
        ),
    [],
  );

  useEffect(() => {
    void refresh();
    return window.desktop.terminalPolicy.subscribeApprovals(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    if (!current) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [current]);

  useEffect(() => setError(null), [current?.id]);

  const remaining = useMemo(
    () => (current ? formatRemaining(current.expiresAt, now) : null),
    [current, now],
  );

  const decide = useCallback(
    async (approved: boolean) => {
      if (!current) return;
      setLoading(true);
      setError(null);
      try {
        await window.desktop.terminalPolicy.decideApproval(
          current.id,
          approved,
        );
        setItems((value) => value.filter((item) => item.id !== current.id));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось отправить решение",
        );
        void refresh();
      } finally {
        setLoading(false);
      }
    },
    [current, refresh],
  );

  const cancel = useCallback(() => {
    if (!loading) void decide(false);
  }, [decide, loading]);

  return (
    <Modal
      open={Boolean(current)}
      onClose={cancel}
      closeOnOverlayClick={!loading}
      className="max-w-2xl"
      rounded="rounded-4xl"
    >
      <Modal.Header showCloseButton={!loading}>
        <div className="flex w-full items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-main-50">
            Подтвердите команду PowerShell
          </h2>
          {items.length > 1 ? (
            <span className="shrink-0 rounded-full bg-main-700/60 px-2.5 py-1 text-xs text-main-300">
              1 из {items.length}
            </span>
          ) : null}
        </div>
      </Modal.Header>
      <Modal.Content>
        {current ? (
          <div className="space-y-4">
            <Alert
              variant={RISK_VARIANTS[current.risk]}
              title={current.purpose}
            >
              Команда приостановлена до вашего решения. Проверьте точный текст и
              рабочую директорию.
            </Alert>
            <CodeView
              code={current.script}
              language="powershell"
              fileName="command.ps1"
              copyable
              defaultActions
              maxContentHeight={280}
            />
            <dl className="space-y-1 rounded-lg bg-main-800/35 p-3 text-xs text-main-400">
              <div className="flex gap-2">
                <dt className="text-main-500">Рабочая директория:</dt>
                <dd className="min-w-0 break-all">{current.cwd}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-main-500">Уровень риска:</dt>
                <dd>{RISK_LABELS[current.risk]}</dd>
              </div>
              {remaining ? (
                <div className="flex gap-2">
                  <dt className="text-main-500">Осталось на решение:</dt>
                  <dd>{remaining}</dd>
                </div>
              ) : null}
              {current.reasons.length ? (
                <div className="flex gap-2">
                  <dt className="text-main-500">Причина запроса:</dt>
                  <dd className="min-w-0">{current.reasons.join("; ")}</dd>
                </div>
              ) : null}
            </dl>
            {error ? (
              <p role="alert" className="text-sm text-danger-light">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="danger"
                disabled={loading}
                onClick={() => void decide(false)}
              >
                Отклонить
              </Button>
              <Button loading={loading} onClick={() => void decide(true)}>
                Разрешить один раз
              </Button>
            </div>
          </div>
        ) : null}
      </Modal.Content>
    </Modal>
  );
}
