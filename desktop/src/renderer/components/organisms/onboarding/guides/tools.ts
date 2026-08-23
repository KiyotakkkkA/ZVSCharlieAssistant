import { APP_PATHS } from "../../../../app/routes";
import { ToolsIcon } from "../../../atoms";
import type { Guide } from "./types";

export const toolsGuide: Guide = {
  id: "tools",
  order: 6,
  title: "Возможности агентов",
  description: "Что умеют встроенные инструменты и как выдавать их безопасно.",
  result: "Вы сможете выбрать действия, которые разрешено выполнять агенту.",
  duration: "2 минуты",
  icon: ToolsIcon,
  recommendedBefore: ["agents"],
  steps: [
    {
      id: "tools-purpose",
      target: "tools-page",
      title: "Инструменты позволяют выполнять действия",
      description:
        "Без инструментов агент может только отвечать текстом. С ними он может читать файлы, искать данные или запускать разрешённые команды.",
      points: [
        "Описание карточки объясняет назначение инструмента.",
        "Не включайте всё сразу: добавляйте возможности по мере необходимости.",
      ],
      route: APP_PATHS.automation.tools,
      placement: "left",
    },
  ],
};
