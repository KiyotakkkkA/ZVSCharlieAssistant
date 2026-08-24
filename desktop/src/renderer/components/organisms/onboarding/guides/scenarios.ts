import { APP_PATHS } from "../../../../app/routes";
import { ScriptIcon } from "../../../atoms";
import type { Guide } from "./types";

export const scenariosGuide: Guide = {
  id: "scenarios",
  title: "Сценарии",
  description: "Повторяемый процесс из триггера, условий и действий.",
  result:
    "Схема сценария читается целиком: видно, что запускает процесс и чем он заканчивается.",
  duration: "6 минут",
  icon: ScriptIcon,
  recommendedBefore: ["agents", "tools"],
  steps: [
    {
      id: "scenarios-purpose",
      target: "scenario-editor",
      title: "Когда нужен сценарий",
      description:
        "Сценарий выполняется без участия человека: по расписанию, по новому письму или сообщению. Агента запускают вручную, сценарий срабатывает сам.",
      points: [
        "Соберите первую версию из двух-трёх узлов и наращивайте её после первого удачного запуска.",
        "История запусков сохраняет результат каждого узла отдельно.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "left",
    },
    {
      id: "scenarios-header",
      target: "scenario-editor-header",
      title: "Панель сценария",
      description:
        "Нажатие на название открывает его для правки. Состояние работает так же, как у агента: черновик не запускается, активный доступен, отключённый сохранён без запуска.",
      points: [
        "«Проверить» находит незаполненные параметры и разорванные связи до первого запуска.",
        "«Запустить» появляется, когда в схеме есть узел ручного запуска.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "bottom",
    },
    {
      id: "scenarios-palette",
      target: "scenario-node-palette",
      title: "Палитра узлов",
      description:
        "Триггеры задают событие запуска, действия выполняют работу, условия ветвят маршрут, обработка данных меняет то, что пришло с прошлого шага.",
      points: [
        "Узел добавляется кликом или перетаскиванием на холст.",
        "У сценария ровно одна точка входа — триггер.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "right",
    },
    {
      id: "scenarios-canvas",
      target: "scenario-canvas",
      title: "Холст",
      description:
        "Соедините выход одного узла со входом следующего: связь задаёт порядок выполнения. Расположение карточек влияет только на читаемость.",
      points: [
        "Узел без входящей связи не выполнится и будет отмечен при проверке.",
        "Сетка, масштаб и мини-карта помогают на схемах от десяти узлов.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "top",
    },
    {
      id: "scenarios-settings",
      target: "scenario-node-settings",
      title: "Параметры узла",
      description:
        "Панель показывает поля выбранного узла. Выберите карточку на холсте, чтобы увидеть её настройки.",
      points: [
        "Поле принимает данные предыдущих узлов через выражения — подсказки открываются прямо в поле.",
        "Переключатель временно исключает узел из выполнения, не удаляя его.",
        "Ошибки проверки показываются над полем, к которому относятся.",
      ],
      route: APP_PATHS.automation.scenarios.create,
      placement: "left",
    },
  ],
};
