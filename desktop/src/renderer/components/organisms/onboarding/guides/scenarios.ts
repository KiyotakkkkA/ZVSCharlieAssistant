import { APP_PATHS } from "../../../../app/routes";
import { ScriptIcon } from "../../../atoms";
import type { Guide } from "./types";

export const scenariosGuide: Guide = {
  id: "scenarios",
  title: "Сценарии",
  description: "Как собрать повторяющуюся работу из нескольких шагов.",
  result: "Вы поймёте, когда нужен сценарий и как читать его схему.",
  duration: "7 минут",
  icon: ScriptIcon,
  recommendedBefore: ["agents", "tools"],
  steps: [
    {
      id: "scenarios-purpose",
      target: "scenario-editor",
      title: "Откроем редактор нового сценария",
      description:
        "Используйте сценарий, когда одна и та же работа регулярно повторяется. На схеме видно, с чего всё начинается и какое действие идёт дальше.",
      points: [
        "Сначала соберите небольшой сценарий из двух или трёх шагов.",
        "История запусков показывает результат каждого шага отдельно.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "left",
    },
    {
      id: "scenarios-header",
      target: "scenario-editor-header",
      title: "Название, состояние и проверка",
      description:
        "Нажмите на название, чтобы изменить его. Черновик ещё не запускается, активный сценарий готов к работе, а отключённый временно остановлен.",
      points: [
        "«Сохранить» записывает изменения.",
        "«Проверить» находит отсутствующие настройки и неверные связи.",
        "«Запустить» появляется, когда в схеме разрешён ручной запуск.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "bottom",
    },
    {
      id: "scenarios-palette",
      target: "scenario-node-palette",
      title: "Слева находятся доступные шаги",
      description:
        "Начало определяет событие запуска. Действия выполняют работу. Условия выбирают дальнейший путь, а обработка данных меняет полученную информацию.",
      points: [
        "Нажмите на шаг или перетащите его на рабочую область.",
        "Начните с одного запуска и одного действия — сложную схему удобнее наращивать постепенно.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "right",
    },
    {
      id: "scenarios-canvas",
      target: "scenario-canvas",
      title: "В центре строится последовательность",
      description: "Соедините выход одного шага со входом другого..",
      points: [
        "Положение карточек влияет только на удобство чтения.",
        "Сетка, масштаб и мини-карта помогают работать с большой схемой.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "top",
    },
    {
      id: "scenarios-settings",
      target: "scenario-node-settings",
      title: "Справа находятся параметры выбранного шага",
      description:
        "У каждого вида шага свой набор полей. Название видно на схеме, переключатель временно отключает шаг, а остальные параметры определяют его действие.",
      points: [
        "Сначала выберите карточку в центре.",
        "Сообщения об ошибках появляются над полями выбранного шага.",
        "Если поле принимает данные предыдущего шага, используйте подсказки выражений внутри этого поля.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "left",
    },
  ],
};
