import { APP_PATHS } from "../../../../app/routes";
import { SkillIcon } from "../../../atoms";
import type { Guide } from "./types";

export const skillsGuide: Guide = {
  id: "skills",
  order: 7,
  title: "Навыки",
  description: "Как сохранить полезные инструкции и применять их повторно.",
  result: "Вы сможете подготовить правило работы, которое подходит нескольким агентам.",
  duration: "5 минут",
  icon: SkillIcon,
  recommendedBefore: ["agents"],
  steps: [
    {
      id: "skills-purpose",
      target: "skill-form",
      title: "Откроем форму нового навыка",
      description:
        "В навыке можно один раз описать порядок работы, требования к результату или важные знания, а затем подключать его к разным агентам.",
      points: [
        "Встроенные навыки уже готовы к использованию.",
        "Пользовательский навык лучше посвящать одной понятной задаче.",
      ],
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
    {
      id: "skills-main",
      target: "skill-form-main",
      title: "Основные сведения",
      description:
        "Название видно людям, а идентификатор используется внутри приложения. Описание помогает агенту понять, когда навык пригодится.",
      points: [
        "Идентификатор пишется латинскими буквами, цифрами и дефисами.",
        "Версию меняют при заметном обновлении инструкции.",
        "Автор — необязательное имя человека или команды, отвечающих за навык.",
        "Только активный навык можно назначить агенту; черновик удобно оставить для доработки.",
      ],
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
    {
      id: "skills-instructions",
      target: "skill-form-instructions",
      title: "Инструкция должна решать одну понятную задачу",
      description:
        "Опишите цель, входные данные, порядок действий, ограничения и ожидаемый результат. Не объединяйте несвязанные задачи в один навык.",
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
    {
      id: "skills-tools",
      target: "skill-form-tools",
      title: "Укажите необходимые возможности",
      description:
        "Отметьте действия, без которых инструкция не может быть выполнена. При назначении навыка эти же возможности нужно разрешить агенту.",
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
  ],
};
