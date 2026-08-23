import { APP_PATHS } from "../../../../app/routes";
import { ChatIcon } from "../../../atoms";
import type { Guide } from "./types";

export const chatGuide: Guide = {
  id: "chat",
  order: 3,
  title: "Первый разговор",
  description: "Как выбрать режим, модель и начать диалог.",
  result: "Вы сможете задать вопрос и выбрать подходящий способ ответа.",
  duration: "3 минуты",
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
      id: "chat-modes",
      target: "chat-composer-mode",
      title: "Выберите, какой результат нужен",
      description:
        "Обычный чат отвечает сразу. Планировщик сначала предлагает последовательность действий. Агент или сценарий выполняют заранее настроенную работу.",
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
