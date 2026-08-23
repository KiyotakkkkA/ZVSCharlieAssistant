import { Alert, Button, InputCheckSlided } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { directoryPolicyStore, terminalPolicyStore } from "../../../stores";

export const WizardStepPolicies = observer(function WizardStepPolicies() {
  const selectDirectory = async () => {
    const path = await window.desktop.selectDirectory();
    if (!path) return;
    const grants = directoryPolicyStore.policy?.grants ?? [];
    if (grants.some((item) => item.path === path)) return;
    await directoryPolicyStore.save({
      grants: [...grants, { path, recursive: true, permissions: ["read", "create", "modify", "execute"] }],
    });
  };
  const setTerminalEnabled = async (enabled: boolean) => {
    const policy = terminalPolicyStore.policy;
    if (!policy) return;
    const { updatedAt: _updatedAt, ...input } = policy;
    await terminalPolicyStore.save({ ...input, enabled, confirmationMode: "always" });
  };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-main-50">Границы доступа</h2>
        <p className="mt-2 text-sm leading-6 text-main-300">
          Ассистент не выходит за пределы разрешённых директорий и спрашивает
          подтверждение перед выполнением команд.
        </p>
      </div>
      <Alert variant="info" title="Вы контролируете доступ">
        Политики можно в любой момент изменить в настройках.
      </Alert>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-main-800/50 p-4">
        <div>
          <div className="text-sm text-main-100">Рабочая папка</div>
          <div className="text-xs text-main-500">Разрешено: {directoryPolicyStore.policy?.grants.length ?? 0}</div>
        </div>
        <Button onClick={() => void selectDirectory()}>Выбрать рабочую папку</Button>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-main-800/50 p-4">
        <div>
          <div className="text-sm text-main-100">Команды терминала</div>
          <div className="text-xs text-main-500">На старте подтверждается каждая команда</div>
        </div>
        <InputCheckSlided checked={terminalPolicyStore.policy?.enabled ?? false} disabled={!terminalPolicyStore.policy} onChange={(value) => void setTerminalEnabled(value)} />
      </div>
    </div>
  );
});
