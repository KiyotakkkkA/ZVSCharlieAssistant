import { APP_PATHS } from "../../../../app/routes";
import { TasksIcon } from "../../../atoms";
import type { Guide } from "./types";

export const tasksGuide: Guide = {
  id: "tasks",
  order: 4,
  title: "Задачи и результаты",
  description: "Где смотреть выполненную работу и причины ошибок.",
  result: "Вы сможете найти результат запуска и понять, завершился ли он успешно.",
  duration: "2 минуты",
  icon: TasksIcon,
  recommendedBefore: ["chat"],
  steps: [
    {
      id: "tasks-history",
      target: "tasks-page",
      title: "Здесь хранится история работы",
      description:
        "В списке видны запуски сценариев и задачи, созданные с помощью модели. У каждой строки есть состояние, время и переход к подробностям.",
      points: [
        "Вкладки разделяют разные виды задач.",
        "Если что-то не получилось, откройте строку и посмотрите сообщение об ошибке.",
      ],
      route: APP_PATHS.tasks,
      placement: "left",
    },
  ],
};
