import { useEffect, useState } from "react";
import { Alert, Button, CodeView, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import type { TerminalApprovalRequest } from "../../../../ipc/contracts";

export function TerminalApprovalModal() {
  const [items, setItems] = useState<TerminalApprovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const current = items[0];

  useEffect(() => {
    let active = true;
    const refresh = () =>
      window.desktop.terminalPolicy
        .pendingApprovals()
        .then((value) => active && setItems(value))
        .catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, 750);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const decide = async (approved: boolean) => {
    if (!current) return;
    setLoading(true);
    try {
      await window.desktop.terminalPolicy.decideApproval(current.id, approved);
      setItems((value) => value.filter((item) => item.id !== current.id));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={Boolean(current)}
      onClose={() => undefined}
      closeOnOverlayClick={false}
      className="max-w-2xl"
      rounded="rounded-4xl"
    >
      <Modal.Header>
        <h2 className="text-lg font-semibold text-main-50">
          Подтвердите команду PowerShell
        </h2>
      </Modal.Header>
      <Modal.Content>
        {current ? (
          <div className="space-y-4">
            <Alert variant="warning" title={current.purpose}>
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
            <div className="rounded-lg bg-main-800/35 p-3 text-xs text-main-400">
              <div>
                <span className="text-main-500">Рабочая директория:</span>{" "}
                {current.cwd}
              </div>
              <div className="mt-1">
                <span className="text-main-500">Риск:</span> {current.risk}
              </div>
            </div>
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
