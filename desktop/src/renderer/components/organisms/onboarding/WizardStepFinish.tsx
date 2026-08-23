import { Button } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { APP_PATHS } from "../../../app/routes";
import { onboardingStore } from "../../../stores";
import { CheckIcon } from "../../atoms";

export const WizardStepFinish = observer(function WizardStepFinish({ onComplete }: { onComplete: () => Promise<void> }) {
  const navigate = useNavigate();
  const ready = [
    ["Профиль", onboardingStore.hasProfile],
    ["Модель", onboardingStore.hasProvider],
    ["Рабочая папка", onboardingStore.hasDirectoryPolicy],
    ["Политика терминала", onboardingStore.hasTerminalPolicy],
  ] as const;
  const go = async (path: string) => {
    await onComplete();
    navigate(path);
  };
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-main-50">Всё готово к началу</h2>
        <p className="mt-2 text-sm text-main-400">Остальные возможности можно настроить позже.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {ready.map(([label, done]) => (
          <div key={label} className="flex items-center gap-2 rounded-lg bg-main-800/50 p-3 text-sm text-main-300">
            {done ? <CheckIcon className="size-5 text-success-light" /> : <span className="size-5 rounded-full border border-main-600" />}
            {label}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void onComplete().then(() => onboardingStore.startTour())}>Пройти интерактивный тур</Button>
        <Button onClick={() => void go(APP_PATHS.chat)}>Открыть чат</Button>
        <Button variant="ghost" onClick={() => void go(APP_PATHS.home)}>Перейти на Главную</Button>
      </div>
    </div>
  );
});
