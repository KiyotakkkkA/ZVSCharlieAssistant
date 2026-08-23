import { APP_PATHS } from "../../../../app/routes";
import { ScriptIcon } from "../../../atoms";
import type { Guide } from "./types";

export const scenariosGuide: Guide = {
  id: "scenarios",
  order: 8,
  title: "Сценарии",
  description: "Как собрать повторяющуюся работу из нескольких шагов.",
  result: "Вы поймёте, когда нужен сценарий и как читать его схему.",
  duration: "3 минуты",
  icon: ScriptIcon,
  recommendedBefore: ["agents", "tools"],
  steps: [
    {
      id: "scenarios-purpose",
      target: "scenarios-page",
      title: "Сценарий выполняет шаги по порядку",
      description:
        "Используйте сценарий, когда одна и та же работа регулярно повторяется. На схеме видно, с чего всё начинается и какое действие идёт дальше.",
      points: [
        "Сначала соберите небольшой сценарий из двух или трёх шагов.",
        "История запусков показывает результат каждого шага отдельно.",
      ],
      route: APP_PATHS.automation.scenarios.index,
      placement: "left",
    },
  ],
};
