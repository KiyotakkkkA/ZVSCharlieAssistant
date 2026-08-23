import { APP_PATHS } from "../../../../app/routes";
import { ChatIcon } from "../../../atoms";
import type { Guide } from "./types";

export const chatGuide: Guide = {
  id: "chat",
  title: "Первый разговор",
  description: "Как выбрать режим, модель и начать диалог.",
  result: "Вы сможете задать вопрос и выбрать подходящий способ ответа.",
  duration: "5 минут",
  icon: ChatIcon,
  recommendedBefore: ["providers"],
  steps: [
    {
      id: "chat-layout",
      target: "chat-page",
      title: "Диалоги сохраняются слева",
      description:
        "Слева находится список разговоров, в центре — текущая переписка, а внизу — поле для нового сообщения.",
      route: APP_PATHS.chat,
      placement: "left",
    },
    {
      id: "chat-dialogs",
      target: "chat-sidebar",
      title: "Каждый разговор хранится отдельно",
      description:
        "Кнопка с плюсом начинает новый диалог. Поиск находит старые разговоры, а действия у строки позволяют переименовать или удалить её.",
      route: APP_PATHS.chat,
      placement: "right",
    },
    {
      id: "chat-modes",
      target: "chat-composer-mode",
      title: "Выберите, какой результат нужен",
      description:
        "Обычный чат отвечает сразу. Планировщик сначала предлагает последовательность действий. Агент или сценарий выполняют заранее настроенную работу.",
      route: APP_PATHS.chat,
      placement: "top",
    },
    {
      id: "chat-composer",
      target: "chat-composer",
      title: "Здесь вводится задача",
      description:
        "Опишите, что нужно получить, добавьте важные условия и приложите файл, если вопрос относится к документу. Кнопка отправки запускает выбранный режим.",
      points: [
        "Чем яснее желаемый результат, тем меньше уточнений понадобится.",
        "Не вставляйте пароли и ключи — для них существует защищённое хранилище.",
        "Во время выполнения кнопка отправки превращается в кнопку остановки.",
      ],
      route: APP_PATHS.chat,
      placement: "top",
    },
    {
      id: "chat-model",
      target: "chat-composer-model",
      title: "Выберите модель для разговора",
      description:
        "Если моделей несколько, здесь можно выбрать подходящую. Для обычного вопроса подойдёт любая включённая текстовая модель.",
      route: APP_PATHS.chat,
      placement: "top",
      optional: true,
    },
  ],
};
