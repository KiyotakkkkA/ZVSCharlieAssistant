import { Badge, Button } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { APP_PATHS, type AppPath } from "../../../app/routes";
import { onboardingStore } from "../../../stores";
import {
  ArrowExpandRightIcon,
  ChatIcon,
  CheckIcon,
  RobotIcon,
  ScriptIcon,
} from "../../atoms";
import type { OnboardingGoal } from "./WizardStepWelcome";

const GOAL_ACTIONS = {
  chat: {
    label: "Открыть чат",
    path: APP_PATHS.chat,
    icon: ChatIcon,
  },
  agent: {
    label: "Создать агента",
    path: APP_PATHS.automation.agents.create,
    icon: RobotIcon,
  },
  scenario: {
    label: "Собрать сценарий",
    path: APP_PATHS.automation.scenarios.create,
    icon: ScriptIcon,
  },
} satisfies Record<OnboardingGoal, { label: string; path: AppPath; icon: typeof ChatIcon }>;

export const WizardStepFinish = observer(function WizardStepFinish({
  goal,
  onComplete,
}: {
  goal: OnboardingGoal;
  onComplete: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const action = GOAL_ACTIONS[goal];
  const ActionIcon = action.icon;
  const readiness = [
    ["Модель", onboardingStore.hasProvider],
    ["Профиль", onboardingStore.hasProfile],
    ["Рабочая папка", onboardingStore.hasDirectoryPolicy],
    ["Команды", onboardingStore.hasTerminalPolicy],
  ] as const;
  const readyCount = readiness.filter(([, ready]) => ready).length;

  const go = async (path: AppPath) => {
    await onComplete();
    navigate(path);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-success-medium/15 text-success-light">
          <CheckIcon className="size-7" />
        </span>
        <Badge variant="success" className="mt-4">
          {readyCount} из {readiness.length} настроено
        </Badge>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-main-50">
          Можно переходить к работе
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-main-400">
          Пропущенные пункты останутся на Главной. Вернуться к ним можно в
          любой момент без повторного запуска мастера.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {readiness.map(([label, ready]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-xl bg-main-800/45 px-4 py-3 ring-1 ring-main-700/40"
          >
            <span className="text-sm text-main-200">{label}</span>
            <Badge variant={ready ? "success" : undefined}>
              {ready ? "Готово" : "Можно позже"}
            </Badge>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="primary"
          rounded="rounded-full"
          className="px-2"
          onClick={() => void go(action.path)}
        >
          <ActionIcon className="size-4" />
          {action.label}
          <ArrowExpandRightIcon className="size-4" />
        </Button>
        <Button
          variant="secondary"
          rounded="rounded-full"
          className="px-2"
          onClick={() =>
            void onComplete().then(() => onboardingStore.startGuide("beginning"))
          }
        >
          Пройти урок «Начало»
        </Button>
        <Button
          variant="secondary"
          rounded="rounded-full"
          className="px-2"
          onClick={() => void go(APP_PATHS.home)}
        >
          На Главную
        </Button>
      </div>
    </div>
  );
});
