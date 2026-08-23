import { APP_PATHS } from "../../../../app/routes";
import { RobotIcon } from "../../../atoms";
import type { Guide } from "./types";

export const agentsGuide: Guide = {
  id: "agents",
  order: 5,
  title: "Агенты",
  description: "Как создать помощника для определённого вида работы.",
  result: "Вы поймёте, из чего состоит агент и когда он полезнее обычного чата.",
  duration: "3 минуты",
  icon: RobotIcon,
  recommendedBefore: ["chat"],
  steps: [
    {
      id: "agents-purpose",
      target: "agents-page",
      title: "Агент — помощник с постоянной ролью",
      description:
        "В отличие от обычного чата, агент заранее знает свою задачу, правила работы и доступные возможности. Например, он может проверять документы или готовить отчёты.",
      points: [
        "Начните с понятного названия и короткого описания результата.",
        "Давайте агенту только те возможности и папки, которые ему действительно нужны.",
      ],
      route: APP_PATHS.automation.agents.index,
      placement: "left",
    },
  ],
};
