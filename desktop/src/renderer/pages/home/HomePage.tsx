import { Button, Card, EmptyState, ProgressBar } from "@kiyotakkkka/zvs-uikit-lib";
import { observer } from "mobx-react-lite";
import { useNavigate } from "react-router-dom";
import { APP_PATHS } from "../../app/routes";
import { onboardingStore, tasksStore, uiStore, userProfileStore } from "../../stores";
import { ChatIcon, CheckIcon, LockIcon, NumbersIcon, RobotIcon, ScriptIcon, SkillIcon } from "../../components/atoms";
import { PROFILE_ANCHORS } from "../../components/organisms/forms";

export const HomePage = observer(function HomePage() {
  const navigate = useNavigate();
  const steps = [
    { title: "Подключите модель", description: "Чтобы чат и агенты могли отвечать.", done: onboardingStore.hasProvider, action: () => navigate(APP_PATHS.settings.providers) },
    { title: "Расскажите о себе", description: "Ассистент учтёт имя и стиль общения.", done: onboardingStore.hasProfile, action: () => uiStore.openSettings(PROFILE_ANCHORS.identity.id) },
    { title: "Разрешите рабочую папку", description: "Задайте безопасные границы доступа.", done: onboardingStore.hasDirectoryPolicy, action: () => navigate(APP_PATHS.settings.policies) },
    { title: "Напишите первое сообщение", description: "Начните свободный диалог.", done: onboardingStore.hasChatMessage, action: () => navigate(APP_PATHS.chat) },
    { title: "Создайте первого агента", description: "Соберите исполнителя под свою задачу.", done: onboardingStore.hasAgent, action: () => navigate(APP_PATHS.automation.agents.create) },
    { title: "Соберите сценарий", description: "Автоматизируйте повторяющийся процесс.", done: onboardingStore.hasScenario, action: () => navigate(APP_PATHS.automation.scenarios.create) },
  ];
  const quick = [
    ["Чат", "Диалог и планирование задач.", APP_PATHS.chat, ChatIcon],
    ["Агенты", "Исполнители для многошаговой работы.", APP_PATHS.automation.agents.index, RobotIcon],
    ["Сценарии", "Повторяемые процессы на визуальном графе.", APP_PATHS.automation.scenarios.index, ScriptIcon],
    ["Навыки", "Переиспользуемые инструкции для агентов.", APP_PATHS.automation.skills.index, SkillIcon],
    ["Векторная БД", "Документы для поиска ответов.", APP_PATHS.storage.vectorDb, NumbersIcon],
    ["Секреты", "Защищённые ключи интеграций.", APP_PATHS.storage.secrets, LockIcon],
  ] as const;
  const latest = [...tasksStore.agentRuns]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl font-semibold text-main-50">{userProfileStore.profile?.displayName ? `Здравствуйте, ${userProfileStore.profile.displayName}` : "Добро пожаловать"}</h1><p className="mt-2 text-sm text-main-400">Начните с короткой настройки или сразу откройте нужный раздел.</p></div>
        <div className="flex gap-2"><Button variant="ghost" onClick={onboardingStore.startTour}>Пройти интерактивный тур</Button><Button variant="ghost" onClick={onboardingStore.openWizard}>Открыть мастер настройки</Button></div>
      </header>
      {!onboardingStore.settings?.onboarding.checklistDismissed ? (
        <Card data-tour="home-checklist" className="bg-main-800/45 p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-main-50">Первые шаги</h2><p className="mt-1 text-xs text-main-400">{Math.round(onboardingStore.checklistProgress * 100)}% готово</p></div><Button variant="ghost" onClick={() => void onboardingStore.dismissChecklist()}>Скрыть чеклист</Button></div>
          <ProgressBar className="mt-4" value={onboardingStore.checklistProgress} max={1} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((step) => <button key={step.title} type="button" onClick={step.action} className={["flex items-center gap-3 rounded-xl p-3 text-left ring-1 ring-main-700/40 transition hover:bg-main-700/30", step.done ? "opacity-60" : ""].join(" ")}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-main-700/50">{step.done ? <CheckIcon className="size-5 text-success-light" /> : <span className="text-xs text-main-400">→</span>}</span><span><span className="block text-sm font-medium text-main-100">{step.title}</span><span className="block text-xs text-main-500">{step.description}</span></span></button>)}
          </div>
        </Card>
      ) : <Button variant="ghost" onClick={() => void onboardingStore.restoreChecklist()}>Показать чеклист первых шагов</Button>}
      <section><h2 className="mb-3 text-lg font-semibold text-main-100">Быстрый старт</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{quick.map(([title, description, path, Icon]) => <Card key={title} className="cursor-pointer bg-main-800/35 p-4 hover:bg-main-700/35" onClick={() => navigate(path)}><Icon className="size-6 text-primary-light" /><h3 className="mt-3 text-sm font-medium text-main-100">{title}</h3><p className="mt-1 text-xs leading-5 text-main-400">{description}</p></Card>)}</div></section>
      <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-main-100">Последние задачи</h2><Button variant="ghost" onClick={() => navigate(APP_PATHS.tasks)}>Все задачи</Button></div>{latest.length ? <div className="space-y-2">{latest.map((task) => <button key={task.id} type="button" onClick={() => navigate(APP_PATHS.tasks)} className="flex w-full items-center justify-between rounded-xl bg-main-800/35 px-4 py-3 text-left"><span className="text-sm text-main-200">{task.title}</span><span className="text-xs text-main-500">{new Date(task.createdAt).toLocaleString("ru-RU")}</span></button>)}</div> : <EmptyState title="Запусков пока нет" description="Здесь появятся последние задачи агентов и сценариев." />}</section>
    </div>
  );
});
