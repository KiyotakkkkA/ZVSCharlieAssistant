import { APP_PATHS } from "../../../../app/routes";
import { TasksIcon } from "../../../atoms";
import type { Guide } from "./types";

export const tasksGuide: Guide = {
  id: "tasks",
  title: "Задачи",
  description: "История запусков и разбор неудачных выполнений.",
  result: "Результат любого запуска найден, причина ошибки прочитана.",
  duration: "3 минуты",
  icon: TasksIcon,
  recommendedBefore: ["chat"],
  steps: [
    {
      id: "tasks-history",
      target: "tasks-page",
      title: "История работы",
      description:
        "Раздел собирает всё, что выполнялось в фоне: запуски агентов и сценариев и задачи, в которых модель создавала новые сущности.",
      points: [
        "Запись остаётся после закрытия приложения — результат не теряется.",
      ],
      route: APP_PATHS.tasks,
      placement: "left",
    },
    {
      id: "tasks-tabs",
      target: "tasks-tabs",
      title: "Вкладки",
      description:
        "«Сценарии» показывает запуски агентов и сценариев. «Создание» — задачи, в которых модель собирала нового агента или навык.",
      route: APP_PATHS.tasks,
      placement: "bottom",
    },
    {
      id: "tasks-list",
      target: "tasks-list",
      title: "Строка запуска",
      description:
        "Время находит нужный запуск, состояние показывает этап, действия открывают подробности или созданный объект.",
      points: [
        "«Выполняется» — работа идёт, страницу обновлять не нужно.",
        "«Готово» — результат открывается из строки.",
        "При ошибке откройте подробности: там сохранены сообщение, исходный запрос и шаг, на котором всё остановилось.",
      ],
      route: APP_PATHS.tasks,
      placement: "left",
    },
  ],
};
