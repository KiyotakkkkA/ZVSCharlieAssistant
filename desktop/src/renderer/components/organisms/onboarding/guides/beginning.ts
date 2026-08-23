import { APP_PATHS } from "../../../../app/routes";
import { HomeIcon } from "../../../atoms";
import type { Guide } from "./types";

export const beginningGuide: Guide = {
  id: "beginning",
  title: "Начало",
  description: "Короткое знакомство с главной страницей, меню и настройками.",
  result: "Вы поймёте, где находятся основные разделы и куда обращаться за помощью.",
  duration: "3 минуты",
  icon: HomeIcon,
  steps: [
    {
      id: "beginning-home",
      target: "home-overview",
      title: "Главная подсказывает следующий шаг",
      description:
        "Здесь видно, что уже готово к работе. Большая кнопка предлагает самое полезное действие на данный момент.",
      points: [
        "Счётчики показывают ваши подключённые модели, агенты и сценарии.",
        "На главную всегда можно вернуться через первый пункт меню.",
      ],
      route: APP_PATHS.home,
      placement: "bottom",
    },
    {
      id: "beginning-navigation",
      target: "sidebar",
      title: "Все разделы находятся слева",
      description:
        "Чат и задачи нужны чаще всего. Остальные возможности собраны в понятные группы: автоматизация, хранилище и настройки.",
      points: [
        "Нажмите на название группы, чтобы увидеть вложенные пункты.",
        "Меню можно свернуть, если нужно больше места.",
      ],
      route: APP_PATHS.home,
      placement: "right",
    },
    {
      id: "beginning-lessons",
      target: "header-help",
      title: "Уроки всегда под рукой",
      description:
        "Знак вопроса открывает страницу со всеми уроками. Их можно проходить в любом порядке и повторять сколько угодно.",
      route: APP_PATHS.home,
      placement: "left",
    },
    {
      id: "beginning-workspaces",
      target: "home-workspaces",
      title: "Три способа начать работу",
      description:
        "Выберите обычный диалог для разовой задачи, агента — для работы по заданным правилам, а сценарий — для процесса, который нужно повторять.",
      points: [
        "Диалог удобен, когда вы хотите обсудить вопрос и уточнять детали по ходу работы.",
        "Агент подходит для постоянной роли: например, помощника по документам или редактора.",
        "Сценарий связывает несколько шагов и запускает их в одном и том же порядке.",
      ],
      route: APP_PATHS.home,
      placement: "top",
    },
    {
      id: "beginning-settings",
      target: "header-settings",
      title: "Общие настройки открываются здесь",
      description:
        "Здесь меняются внешний вид, обращение к вам, работа приложения в фоне и перенос данных.",
      route: APP_PATHS.home,
      placement: "left",
    },
    {
      id: "beginning-checklist",
      target: "home-checklist",
      title: "Настраивайте приложение в удобном темпе",
      description:
        "Список первых шагов ведёт прямо к нужному месту и сам отмечает выполненные действия. Строгого порядка нет.",
      route: APP_PATHS.home,
      placement: "right",
    },
  ],
};
