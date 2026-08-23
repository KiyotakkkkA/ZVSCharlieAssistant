import { Alert, Button } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { directoryPolicyStore, terminalPolicyStore } from "../../../stores";
import { CheckIcon, FolderIcon, PolicyIcon } from "../../atoms";

export const WizardStepPolicies = observer(function WizardStepPolicies() {
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [terminalLoading, setTerminalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectDirectory = async () => {
    setDirectoryLoading(true);
    setError(null);
    try {
      const path = await window.desktop.selectDirectory();
      if (!path) return;
      const grants = directoryPolicyStore.policy?.grants ?? [];
      if (grants.some((item) => item.path === path)) return;
      await directoryPolicyStore.save({
        grants: [
          ...grants,
          {
            path,
            recursive: true,
            permissions: ["read", "create", "modify", "execute"],
          },
        ],
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось разрешить рабочую папку.",
      );
    } finally {
      setDirectoryLoading(false);
    }
  };

  const applyRecommendedTerminalPolicy = async () => {
    setTerminalLoading(true);
    setError(null);
    try {
      const recommended = await window.desktop.terminalPolicy.recommended();
      await terminalPolicyStore.save(recommended);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось применить безопасную политику.",
      );
    } finally {
      setTerminalLoading(false);
    }
  };

  const directoryReady = Boolean(directoryPolicyStore.policy?.grants.length);
  const terminalReady = Boolean(
    terminalPolicyStore.policy?.enabled &&
      terminalPolicyStore.policy.allowedCommands.length,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
          <PolicyIcon className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-semibold text-main-50">
            Задайте безопасные границы
          </h2>
          <p className="mt-1 text-sm text-main-400">
            Доступ запрещён по умолчанию и расширяется только вашим решением.
          </p>
        </div>
      </div>

      <Alert variant="info" title="Что будет разрешено">
        Файловые операции останутся внутри выбранных папок. Команды PowerShell
        будут ограничены стартовым набором и потребуют подтверждения.
      </Alert>

      <div className="space-y-3">
        <SetupAction
          icon={FolderIcon}
          title="Рабочая папка"
          description={
            directoryReady
              ? `Разрешено папок: ${directoryPolicyStore.policy?.grants.length ?? 0}`
              : "Выберите папку проекта, с которой сможет работать ассистент."
          }
          done={directoryReady}
          actionLabel={directoryReady ? "Добавить ещё" : "Выбрать папку"}
          loading={directoryLoading}
          onClick={() => void selectDirectory()}
        />
        <SetupAction
          icon={PolicyIcon}
          title="Команды терминала"
          description={
            terminalReady
              ? "Безопасный стартовый набор команд применён."
              : "Разрешить чтение, поиск и запись с подтверждением каждой команды."
          }
          done={terminalReady}
          actionLabel={terminalReady ? "Применено" : "Применить безопасный набор"}
          loading={terminalLoading}
          disabled={terminalReady}
          onClick={() => void applyRecommendedTerminalPolicy()}
        />
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
});

function SetupAction({
  icon: Icon,
  title,
  description,
  done,
  actionLabel,
  loading,
  disabled,
  onClick,
}: {
  icon: typeof FolderIcon;
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-main-800/45 p-4 ring-1 ring-main-700/40">
      <span
        className={[
          "grid size-10 shrink-0 place-items-center rounded-xl",
          done
            ? "bg-success-medium/15 text-success-light"
            : "bg-main-700/50 text-main-300",
        ].join(" ")}
      >
        {done ? <CheckIcon className="size-5" /> : <Icon className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-main-100">{title}</p>
        <p className="mt-1 text-xs leading-5 text-main-500">{description}</p>
      </div>
      <Button
        variant={done ? "secondary" : "primary"}
        rounded="rounded-full"
        className="shrink-0 px-2"
        loading={loading}
        disabled={disabled}
        onClick={onClick}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
