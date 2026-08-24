import { APP_PATHS } from "../../../../app/routes";
import { SkillIcon } from "../../../atoms";
import type { Guide } from "./types";

export const skillsGuide: Guide = {
  id: "skills",
  title: "Навыки",
  description: "Методика работы, которую переиспользуют несколько агентов.",
  result:
    "Готова инструкция, подключаемая к разным агентам без копирования текста.",
  duration: "4 минуты",
  icon: SkillIcon,
  recommendedBefore: ["agents"],
  steps: [
    {
      id: "skills-purpose",
      target: "skill-form",
      title: "Навык против инструкции агента",
      description:
        "Инструкция агента описывает, кто он. Навык описывает, как выполняется конкретная работа, и подключается к любому агенту, которому она нужна.",
      points: [
        "Встроенные навыки уже готовы: отчёт по ГОСТ, работа с PowerShell, создание агентов и навыков.",
        "Один навык — одна задача. Смесь из трёх задач не сработает ни в одной.",
      ],
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
    {
      id: "skills-main",
      target: "skill-form-main",
      title: "Название и версия",
      description:
        "Название видно человеку, идентификатор используется внутри приложения. Описание читает модель, когда решает, загружать полную инструкцию или нет.",
      points: [
        "Идентификатор: латиница в нижнем регистре, цифры и дефисы.",
        "В описании нужны слова-триггеры задачи, иначе навык не будет найден.",
        "Версию повышают при заметной правке инструкции.",
        "Назначить агенту можно только активный навык.",
      ],
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
    {
      id: "skills-instructions",
      target: "skill-form-instructions",
      title: "Инструкция",
      description:
        "Опишите, когда навык применяется, что нужно на входе, порядок шагов, ограничения и признак готового результата.",
      points: [
        "Пороги и форматы задавайте числами и примерами, а не словами «покороче».",
        "Добавьте раздел проверки: что перечитать перед выдачей ответа.",
      ],
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
    {
      id: "skills-tools",
      target: "skill-form-tools",
      title: "Требуемые инструменты",
      description:
        "Отметьте инструменты, без которых инструкцию физически не выполнить. Те же инструменты придётся разрешить агенту при назначении навыка.",
      points: [
        "Навык-методичка без обращения к системе обходится пустым списком.",
      ],
      route: APP_PATHS.automation.skills.create,
      placement: "left",
    },
  ],
};
