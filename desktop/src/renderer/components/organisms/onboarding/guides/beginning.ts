import { APP_PATHS } from "../../../../app/routes";
import { ChatIcon } from "../../../atoms";
import type { Guide } from "./types";

export const beginningGuide: Guide = {
  id: "beginning",
  title: "Начало",
  description: "Короткое знакомство с рабочим экраном, меню и настройками.",
  result: "Вы поймёте, где начать работу и куда обращаться за помощью.",
  duration: "2 минуты",
  icon: ChatIcon,
  steps: [
    {
      id: "beginning-chat",
      target: "chat-page",
      title: "Работа начинается с диалога",
      description:
        "После запуска открывается чат. Здесь можно задать вопрос, составить план или поручить работу заранее настроенному помощнику.",
      points: [
        "Старые разговоры находятся слева, текущая переписка — в центре.",
        "Если модель ещё не подключена, приложение предложит перейти к её настройке.",
      ],
      route: APP_PATHS.chat,
      placement: "left",
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
        "Чат подходит для разовой задачи, агент — для постоянной роли, сценарий — для повторяемого процесса.",
      ],
      route: APP_PATHS.chat,
      placement: "right",
    },
    {
      id: "beginning-lessons",
      target: "header-help",
      title: "Уроки всегда под рукой",
      description:
        "Знак вопроса открывает страницу со всеми уроками. Их можно проходить в любом порядке и повторять сколько угодно.",
      route: APP_PATHS.chat,
      placement: "left",
    },
    {
      id: "beginning-settings",
      target: "header-settings",
      title: "Общие настройки открываются здесь",
      description:
        "Здесь меняются внешний вид, обращение к вам, работа приложения в фоне и перенос данных.",
      route: APP_PATHS.chat,
      placement: "left",
    },
  ],
};
