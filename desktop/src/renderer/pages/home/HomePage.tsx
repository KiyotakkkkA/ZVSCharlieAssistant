import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Tooltip,
} from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { APP_PATHS, type AppPath } from "../../app/routes";
import {
  automationStore,
  onboardingStore,
  tasksStore,
  textProviderStore,
  uiStore,
  userProfileStore,
} from "../../stores";
import {
  ArrowExpandRightIcon,
  ChatIcon,
  CheckIcon,
  CogIcon,
  NumbersIcon,
  PlayCircleIcon,
  RobotIcon,
  ScriptIcon,
} from "../../components/atoms";
import { PROFILE_ANCHORS } from "../../components/organisms/forms";
import { useAppNavigation } from "@renderer/hooks";

interface GuideTask {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  done: boolean;
  action: () => void;
}

export const HomePage = observer(function HomePage() {
  const { goTo } = useAppNavigation();
  const guideTasks: GuideTask[] = [
    {
      id: "provider",
      title: "Подключить модель",
      description: "Обязательный шаг для диалога, планировщика и агентов.",
      actionLabel: "Подключить",
      done: onboardingStore.hasProvider,
      action: () => goTo(APP_PATHS.settings.providers),
    },
    {
      id: "profile",
      title: "Настроить профиль",
      description: "Укажите имя, контекст и предпочтительный стиль ответов.",
      actionLabel: "Настроить",
      done: onboardingStore.hasProfile,
      action: () => uiStore.openSettings(PROFILE_ANCHORS.identity.id),
    },
    {
      id: "directory",
      title: "Выбрать рабочую папку",
      description: "Определите безопасные границы доступа к файлам.",
      actionLabel: "Выбрать",
      done: onboardingStore.hasDirectoryPolicy,
      action: () => goTo(APP_PATHS.settings.policies),
    },
    {
      id: "chat",
      title: "Начать первый диалог",
      description: "Проверьте подключение на реальной задаче.",
      actionLabel: "Открыть чат",
      done: onboardingStore.hasChatMessage,
      action: () => goTo(APP_PATHS.chat),
    },
    {
      id: "agent",
      title: "Создать агента",
      description: "Соберите исполнителя с моделью, навыками и инструментами.",
      actionLabel: "Создать",
      done: onboardingStore.hasAgent,
      action: () => goTo(APP_PATHS.automation.agents.create),
    },
    {
      id: "scenario",
      title: "Собрать сценарий",
      description: "Свяжите действия в воспроизводимый процесс.",
      actionLabel: "Собрать",
      done: onboardingStore.hasScenario,
      action: () => goTo(APP_PATHS.automation.scenarios.create),
    },
  ];
  const nextTask = guideTasks.find((task) => !task.done);
  const completed = guideTasks.filter((task) => task.done).length;
  const latest = [...tasksStore.agentRuns]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-360 space-y-5 p-5 xl:p-7">
      <section
        data-tour="home-overview"
        className="relative overflow-hidden rounded-2xl bg-main-800/45 p-6 ring-1 ring-main-700/45"
      >
        <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-accent-medium/8 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
          <div className="max-w-2xl">
            <Badge variant={nextTask ? "info" : "success"}>
              {nextTask
                ? `${completed} из ${guideTasks.length} шагов готово`
                : "Настройка завершена"}
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-main-50">
              {userProfileStore.profile?.displayName
                ? `Здравствуйте, ${userProfileStore.profile.displayName}`
                : "Добро пожаловать в ZVS Assistant"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-main-400">
              {nextTask
                ? "Подготовьте рабочее окружение и переходите к первой полезной задаче."
                : "Основные возможности настроены — можно начинать работу."}
            </p>
            {nextTask ? (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  rounded="rounded-full"
                  className="px-2"
                  onClick={nextTask.action}
                >
                  {nextTask.actionLabel}
                  <ArrowExpandRightIcon className="size-4" />
                </Button>
                <span className="text-xs text-main-500">
                  Следующий шаг: {nextTask.title.toLocaleLowerCase("ru-RU")}
                </span>
              </div>
            ) : (
              <Button
                variant="primary"
                rounded="rounded-full"
                className="mt-6 px-2"
                onClick={() => goTo(APP_PATHS.chat)}
              >
                <ChatIcon className="size-4" />
                Открыть чат
              </Button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-main-900/35 p-3 ring-1 ring-main-700/35">
            <Metric
              value={textProviderStore.enabledModels.length}
              label="моделей"
            />
            <Metric value={automationStore.agents.length} label="агентов" />
            <Metric
              value={automationStore.scenarios.length}
              label="сценариев"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        {!onboardingStore.settings?.onboarding.checklistDismissed ? (
          <Card data-tour="home-checklist" className="bg-main-800/35 p-0">
            <div className="flex items-center justify-between gap-4 border-b border-main-700/40 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-main-100">
                  Подготовка к работе
                </h2>
                <p className="mt-1 text-xs text-main-500">
                  Выполняйте задачи в удобном порядке — прогресс сохранится.
                </p>
              </div>
              <Tooltip label="Скрыть список" placement="bottom-left">
                <Button
                  variant="ghost"
                  rounded="rounded-lg"
                  label="Скрыть список"
                  className="size-9 p-0 text-main-400 hover:bg-main-700/60 hover:text-main-100"
                  onClick={() => void onboardingStore.dismissChecklist()}
                >
                  <CheckIcon className="size-4" />
                </Button>
              </Tooltip>
            </div>
            <div className="px-5 pt-4">
              <ProgressBar
                value={completed}
                max={guideTasks.length}
                label={`${completed} из ${guideTasks.length}`}
              />
            </div>
            <ol className="divide-y divide-main-700/35 px-5 py-2">
              {guideTasks.map((task, index) => (
                <li key={task.id} className="flex items-center gap-3 py-3">
                  <span
                    className={[
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      task.done
                        ? "bg-success-medium/15 text-success-light"
                        : "bg-main-700/55 text-main-300",
                    ].join(" ")}
                  >
                    {task.done ? <CheckIcon className="size-4" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        task.done
                          ? "text-sm text-main-400 line-through"
                          : "text-sm font-medium text-main-100"
                      }
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-main-500">
                      {task.description}
                    </p>
                  </div>
                  {!task.done ? (
                    <Button
                      variant="secondary"
                      rounded="rounded-full"
                      className="shrink-0 px-2"
                      onClick={task.action}
                    >
                      {task.actionLabel}
                    </Button>
                  ) : (
                    <Badge variant="success">Готово</Badge>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <button
            type="button"
            className="flex min-h-24 items-center justify-between rounded-2xl bg-main-800/30 px-5 text-left ring-1 ring-main-700/40 hover:bg-main-800/50"
            onClick={() => void onboardingStore.restoreChecklist()}
          >
            <span>
              <span className="block text-sm font-medium text-main-100">
                Подготовка к работе
              </span>
              <span className="mt-1 block text-xs text-main-500">
                Показать скрытый список задач
              </span>
            </span>
            <ArrowExpandRightIcon className="size-5 text-main-400" />
          </button>
        )}

        <Card
          data-tour="home-recent"
          className="flex min-h-0 flex-col bg-main-800/35 p-0"
        >
          <div className="flex items-center justify-between border-b border-main-700/40 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-main-100">
                Последние задачи
              </h2>
              <p className="mt-1 text-xs text-main-500">
                Недавние запуски и их состояние
              </p>
            </div>
            <Tooltip label="Открыть все задачи" placement="bottom-left">
              <Button
                variant="ghost"
                rounded="rounded-lg"
                label="Открыть все задачи"
                className="size-9 p-0 text-main-400 hover:bg-main-700/60 hover:text-main-100"
                onClick={() => goTo(APP_PATHS.tasks)}
              >
                <ArrowExpandRightIcon className="size-4" />
              </Button>
            </Tooltip>
          </div>
          {latest.length ? (
            <div className="divide-y divide-main-700/35 px-5 py-2">
              {latest.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => goTo(APP_PATHS.tasks)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className="size-2 shrink-0 rounded-full bg-accent-light" />
                  <span className="min-w-0 flex-1 truncate text-sm text-main-200">
                    {task.title}
                  </span>
                  <span className="text-[11px] text-main-600">
                    {new Date(task.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6">
              <EmptyState
                title="История пока пуста"
                description="Первый запуск агента или сценария появится здесь."
                action={
                  <Button
                    variant="secondary"
                    rounded="rounded-full"
                    className="px-2"
                    onClick={() => goTo(APP_PATHS.chat)}
                  >
                    <ChatIcon className="size-4" />
                    Начать в чате
                  </Button>
                }
              />
            </div>
          )}
        </Card>
      </div>

      <section data-tour="home-workspaces">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-main-100">
              Рабочие области
            </h2>
            <p className="mt-1 text-xs text-main-500">
              Выберите способ решения задачи
            </p>
          </div>
          <div className="flex items-center gap-1">
            <GuideAction
              icon={PlayCircleIcon}
              label="Открыть уроки"
              onClick={() => goTo(APP_PATHS.guides)}
            />
            <GuideAction
              icon={CogIcon}
              label="Настройки приложения"
              onClick={() => uiStore.openSettings()}
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <WorkspaceCard
            icon={ChatIcon}
            title="Обсудить задачу"
            description="Задайте вопрос, составьте план или разберите данные вместе с моделью."
            path={APP_PATHS.chat}
            onOpen={goTo}
          />
          <WorkspaceCard
            icon={RobotIcon}
            title="Поручить агенту"
            description="Настройте исполнителя с конкретной ролью, навыками и доступами."
            path={APP_PATHS.automation.agents.index}
            onOpen={goTo}
          />
          <WorkspaceCard
            icon={ScriptIcon}
            title="Автоматизировать процесс"
            description="Соберите повторяемую последовательность действий на визуальном графе."
            path={APP_PATHS.automation.scenarios.index}
            onOpen={goTo}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SecondaryLink
            icon={NumbersIcon}
            label="Базы знаний"
            onClick={() => goTo(APP_PATHS.storage.vectorDb)}
          />
          <SecondaryLink
            icon={CogIcon}
            label="Политики доступа"
            onClick={() => goTo(APP_PATHS.settings.policies)}
          />
        </div>
      </section>
    </div>
  );
});

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-main-800/55 px-3 py-4 text-center">
      <div className="text-xl font-semibold tabular-nums text-main-50">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-main-500">{label}</div>
    </div>
  );
}

function GuideAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof PlayCircleIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip label={label} placement="bottom-left">
      <Button
        variant="ghost"
        rounded="rounded-lg"
        label={label}
        className="size-9 p-0 text-main-400 hover:bg-main-700/60 hover:text-main-100"
        onClick={onClick}
      >
        <Icon className="size-4" />
      </Button>
    </Tooltip>
  );
}

function WorkspaceCard({
  icon: Icon,
  title,
  description,
  path,
  onOpen,
}: {
  icon: typeof ChatIcon;
  title: string;
  description: string;
  path: AppPath;
  onOpen: (path: AppPath) => void;
}) {
  return (
    <button
      type="button"
      className="group flex min-h-36 flex-col rounded-2xl bg-main-800/30 p-5 text-left ring-1 ring-main-700/40 transition hover:-translate-y-0.5 hover:bg-main-800/55 hover:ring-main-600/70"
      onClick={() => onOpen(path)}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
        <Icon className="size-5" />
      </span>
      <span className="mt-4 flex w-full items-center justify-between gap-3">
        <span className="text-sm font-semibold text-main-100">{title}</span>
        <ArrowExpandRightIcon className="size-4 text-main-600 transition group-hover:translate-x-0.5 group-hover:text-main-300" />
      </span>
      <span className="mt-2 text-xs leading-5 text-main-500">
        {description}
      </span>
    </button>
  );
}

function SecondaryLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof CogIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="secondary"
      rounded="rounded-full"
      className="px-2"
      onClick={onClick}
    >
      <Icon className="size-4" />
      {label}
    </Button>
  );
}
