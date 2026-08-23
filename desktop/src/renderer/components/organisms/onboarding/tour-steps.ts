import { APP_PATHS, type AppPath } from "../../../app/routes";

export interface TourStep {
  id: string;
  chapter: string;
  target: string;
  title: string;
  description: string;
  points?: readonly string[];
  route: AppPath;
  placement?: "top" | "bottom" | "left" | "right";
  optional?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "home-overview",
    chapter: "Главная",
    target: "home-overview",
    title: "Продолжайте с нужного места",
    description:
      "Главная показывает готовность приложения и предлагает один следующий шаг вместо набора равнозначных ссылок.",
    points: [
      "Счётчики справа отражают реальные модели, агенты и сценарии.",
      "Основная кнопка меняется вместе с прогрессом настройки.",
    ],
    route: APP_PATHS.home,
    placement: "bottom",
  },
  {
    id: "navigation",
    chapter: "Навигация",
    target: "sidebar",
    title: "Разделы сгруппированы по задачам",
    description:
      "Верхние пункты нужны для ежедневной работы, а автоматизация, хранилище и настройки раскрываются по мере необходимости.",
    points: [
      "Чат — работа с моделью.",
      "Задачи — история выполнений.",
      "Меню можно свернуть до панели иконок.",
    ],
    route: APP_PATHS.home,
    placement: "right",
  },
  {
    id: "home-checklist",
    chapter: "Главная",
    target: "home-checklist",
    title: "Настройку не обязательно заканчивать сразу",
    description:
      "Каждый пункт ведёт прямо к нужному действию и автоматически отмечается после результата.",
    points: [
      "Порядок свободный.",
      "Список можно скрыть и вернуть из настроек.",
    ],
    route: APP_PATHS.home,
    placement: "right",
  },
  {
    id: "chat-page",
    chapter: "Чат",
    target: "chat-page",
    title: "Одна область — несколько способов работы",
    description:
      "Слева находятся диалоги, в центре — история текущего разговора, снизу — единая строка запуска.",
    points: [
      "Сообщения и запуски сохраняются в диалоге.",
      "Панели задач и памяти открываются без ухода со страницы.",
    ],
    route: APP_PATHS.chat,
    placement: "left",
  },
  {
    id: "chat-modes",
    chapter: "Чат",
    target: "chat-composer-mode",
    title: "Выберите тип результата",
    description:
      "Режим определяет, кто обработает запрос и что появится в ответе.",
    points: [
      "Чат отвечает сразу.",
      "Планировщик раскладывает задачу на шаги.",
      "Агент и сценарий запускают настроенного исполнителя.",
    ],
    route: APP_PATHS.chat,
    placement: "top",
  },
  {
    id: "chat-model",
    chapter: "Чат",
    target: "chat-composer-model",
    title: "Модель выбирается для каждого диалога",
    description:
      "Здесь видны только включённые текстовые модели. Последний выбор сохраняется вместе с диалогом.",
    route: APP_PATHS.chat,
    placement: "top",
    optional: true,
  },
  {
    id: "tasks-page",
    chapter: "Задачи",
    target: "tasks-page",
    title: "Контролируйте историю выполнений",
    description:
      "Страница объединяет запуски сценариев и создание сущностей с помощью модели.",
    points: [
      "Вкладки разделяют типы задач.",
      "Из строки можно открыть сценарий, результат или ошибку.",
      "Список обновляется автоматически.",
    ],
    route: APP_PATHS.tasks,
    placement: "left",
  },
  {
    id: "agents-page",
    chapter: "Автоматизация",
    target: "agents-page",
    title: "Агент — настроенный исполнитель",
    description:
      "У агента есть роль, модель, инструкции, навыки, инструменты и собственные ограничения доступа.",
    points: [
      "Создайте вручную или с помощью модели.",
      "Переключайтесь между карточками и таблицей.",
    ],
    route: APP_PATHS.automation.agents.index,
    placement: "left",
  },
  {
    id: "tools-page",
    chapter: "Автоматизация",
    target: "tools-page",
    title: "Инструменты дают агенту действия",
    description:
      "Это встроенные операции с файлами, терминалом, поиском и данными. Они включаются для конкретного агента.",
    points: [
      "Карточка показывает назначение и входные параметры.",
      "Секреты привязываются без раскрытия значения агенту.",
    ],
    route: APP_PATHS.automation.tools,
    placement: "left",
  },
  {
    id: "skills-page",
    chapter: "Автоматизация",
    target: "skills-page",
    title: "Навыки хранят воспроизводимые инструкции",
    description:
      "Навык объясняет агенту, как выполнять специализированную работу, и может использоваться многими агентами.",
    points: [
      "Встроенные навыки готовы сразу.",
      "Пользовательские навыки можно создавать и редактировать.",
    ],
    route: APP_PATHS.automation.skills.index,
    placement: "left",
  },
  {
    id: "scenarios-page",
    chapter: "Автоматизация",
    target: "scenarios-page",
    title: "Сценарий связывает действия в процесс",
    description:
      "На графе триггер запускает цепочку условий и действий, а результат можно передать дальше.",
    points: [
      "Черновик безопасно редактировать до активации.",
      "История запусков помогает разбирать каждый узел.",
    ],
    route: APP_PATHS.automation.scenarios.index,
    placement: "left",
  },
  {
    id: "secrets-page",
    chapter: "Хранилище",
    target: "secrets-page",
    title: "Секреты отделены от настроек",
    description:
      "Ключи и пароли хранятся централизованно, а провайдеры и интеграции получают только ссылку на секрет.",
    points: [
      "Категории упрощают поиск.",
      "Значение не отображается в списках и конфигурациях.",
    ],
    route: APP_PATHS.storage.secrets,
    placement: "left",
  },
  {
    id: "vector-page",
    chapter: "Хранилище",
    target: "vector-page",
    title: "Базы знаний добавляют собственный контекст",
    description:
      "Загрузите документы, дождитесь индексации и разрешите агенту искать по подходящим фрагментам.",
    points: [
      "Слева — базы, справа — параметры и документы.",
      "Для индексации нужна embedding-модель.",
    ],
    route: APP_PATHS.storage.vectorDb,
    placement: "left",
  },
  {
    id: "providers-page",
    chapter: "Настройки",
    target: "providers-page",
    title: "Провайдеры управляют доступными моделями",
    description:
      "Сначала создайте подключение, проверьте его, затем включите модели, которые должны видеть чат и агенты.",
    points: [
      "Текстовые модели отвечают и рассуждают.",
      "Embedding-модели индексируют базы знаний.",
    ],
    route: APP_PATHS.settings.providers,
    placement: "left",
  },
  {
    id: "policies-page",
    chapter: "Настройки",
    target: "policies-page",
    title: "Политики задают верхнюю границу доступа",
    description:
      "Агент может получить меньше прав, но не сможет обойти глобальные ограничения файлов, терминала и памяти.",
    points: [
      "Начинайте с рекомендуемой терминальной политики.",
      "Разрешайте только рабочие директории.",
    ],
    route: APP_PATHS.settings.policies,
    placement: "left",
  },
  {
    id: "integrations-page",
    chapter: "Настройки",
    target: "integrations-page",
    title: "Интеграции связывают внешние каналы",
    description:
      "Подключения Telegram, почты, GitHub и GitLab можно использовать как источники событий или каналы доставки.",
    points: [
      "Проверяйте соединение до сохранения.",
      "Учётные данные берутся из защищённых секретов.",
    ],
    route: APP_PATHS.settings.integrations,
    placement: "left",
  },
  {
    id: "home-workspaces",
    chapter: "Готово",
    target: "home-workspaces",
    title: "Начните с результата, который нужен сейчас",
    description:
      "Рабочие области на Главной ведут к диалогу, агенту или сценарию, а руководство всегда доступно через кнопку помощи.",
    route: APP_PATHS.home,
    placement: "top",
  },
] as const;
