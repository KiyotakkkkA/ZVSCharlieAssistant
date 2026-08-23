import { APP_PATHS } from "../../../../app/routes";
import { SkillIcon } from "../../../atoms";
import type { Guide } from "./types";

export const skillsGuide: Guide = {
  id: "skills",
  order: 7,
  title: "Навыки",
  description: "Как сохранить полезные инструкции и применять их повторно.",
  result: "Вы сможете подготовить правило работы, которое подходит нескольким агентам.",
  duration: "2 минуты",
  icon: SkillIcon,
  recommendedBefore: ["agents"],
  steps: [
    {
      id: "skills-purpose",
      target: "skills-page",
      title: "Навык — это памятка для агента",
      description:
        "В навыке можно один раз описать порядок работы, требования к результату или важные знания, а затем подключать его к разным агентам.",
      points: [
        "Встроенные навыки уже готовы к использованию.",
        "Пользовательский навык лучше посвящать одной понятной задаче.",
      ],
      route: APP_PATHS.automation.skills.index,
      placement: "left",
    },
  ],
};
