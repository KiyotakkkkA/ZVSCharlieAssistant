import { APP_PATHS } from "../../../../app/routes";
import { ToolsIcon } from "../../../atoms";
import type { Guide } from "./types";

export const toolsGuide: Guide = {
  id: "tools",
  title: "Инструменты",
  description: "Что умеют встроенные инструменты и как выдавать их безопасно.",
  result:
    "Понятно, какие действия доступны агенту и чем оплачивается каждое разрешение.",
  duration: "3 минуты",
  icon: ToolsIcon,
  recommendedBefore: ["agents"],
  steps: [
    {
      id: "tools-purpose",
      target: "tools-page",
      title: "Инструмент — это действие",
      description:
        "Без инструментов агент только пишет текст. С ними он читает файлы, ищет в базе знаний, запускает разрешённые команды и собирает документы.",
      points: [
        "Инструменты встроены в приложение: создавать их вручную не нужно.",
        "Инструмент начинает работать только после того, как назначен конкретному агенту.",
      ],
      route: APP_PATHS.automation.tools,
      placement: "left",
    },
    {
      id: "tools-list",
      target: "tools-list",
      title: "Каталог",
      description:
        "Карточка называет действие, категория группирует похожие, описание уточняет результат вызова.",
      points: [
        "Категория помогает понять зону риска: чтение, запись, сеть, выполнение команд.",
      ],
      route: APP_PATHS.automation.tools,
      placement: "left",
    },
    {
      id: "tools-details",
      target: "tool-details",
      openTarget: "tools-first",
      title: "Требования инструмента",
      description:
        "Карточка раскрывает, нужен ли инструменту секрет, требуется ли подтверждение и что он принимает на входе и возвращает на выходе.",
      points: [
        "Подтверждение означает, что перед необратимым действием приложение спросит разрешение.",
        "Секрет подставляется из хранилища и не попадает в инструкцию агента.",
        "Если инструмент возвращает ошибку доступа — разрешение выдаётся в политиках, а не здесь.",
      ],
      route: APP_PATHS.automation.tools,
      placement: "left",
      optional: true,
    },
  ],
};
