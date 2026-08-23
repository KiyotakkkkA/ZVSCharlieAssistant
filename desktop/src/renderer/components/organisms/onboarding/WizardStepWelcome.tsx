import { ChatIcon, CheckIcon, RobotIcon, ScriptIcon } from "../../atoms";

export type OnboardingGoal = "chat" | "agent" | "scenario";

const GOALS = [
  {
    id: "chat" as const,
    icon: ChatIcon,
    title: "Работать в диалоге",
    description: "Задавать вопросы, строить планы и разбирать материалы.",
  },
  {
    id: "agent" as const,
    icon: RobotIcon,
    title: "Поручать задачи агентам",
    description: "Создавать исполнителей с ролью, навыками и доступами.",
  },
  {
    id: "scenario" as const,
    icon: ScriptIcon,
    title: "Автоматизировать процессы",
    description: "Собирать повторяемые процессы на визуальном графе.",
  },
];

export function WizardStepWelcome({
  goal,
  onGoalChange,
}: {
  goal: OnboardingGoal;
  onGoalChange: (goal: OnboardingGoal) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-main-50">
          Что вы хотите сделать сначала?
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-main-400">
          Ответ определит финальное действие мастера. Настройки при этом
          останутся универсальными и их можно изменить позже.
        </p>
      </div>
      <div className="space-y-2">
        {GOALS.map((item) => {
          const selected = item.id === goal;
          return (
            <button
              key={item.id}
              type="button"
              className={[
                "flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-1 transition",
                selected
                  ? "bg-accent-medium/10 ring-accent-light/50"
                  : "bg-main-800/40 ring-main-700/45 hover:bg-main-800/65 hover:ring-main-600/70",
              ].join(" ")}
              onClick={() => onGoalChange(item.id)}
            >
              <span
                className={[
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  selected
                    ? "bg-accent-medium/15 text-accent-light"
                    : "bg-main-700/50 text-main-300",
                ].join(" ")}
              >
                <item.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-main-100">
                  {item.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-main-500">
                  {item.description}
                </span>
              </span>
              <span
                className={[
                  "grid size-6 shrink-0 place-items-center rounded-full ring-1",
                  selected
                    ? "bg-accent-medium text-main-950 ring-accent-light"
                    : "ring-main-600",
                ].join(" ")}
              >
                {selected ? <CheckIcon className="size-4" /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
