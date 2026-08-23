import { APP_PATHS } from "../../../../app/routes";
import { GraphIcon } from "../../../atoms";
import type { Guide } from "./types";

export const agentsGuide: Guide = {
  id: "agents",
  title: "Агенты",
  description: "Как создать помощника для определённого вида работы.",
  result:
    "Вы поймёте, из чего состоит агент и когда он полезнее обычного чата.",
  duration: "7 минут",
  icon: GraphIcon,
  recommendedBefore: ["chat"],
  steps: [
    {
      id: "agents-purpose",
      target: "agent-form",
      title: "Откроем форму нового агента",
      description:
        "В отличие от обычного чата, агент заранее знает свою задачу, правила работы и доступные возможности. Например, он может проверять документы или готовить отчёты.",
      points: [
        "Агент — помощник с постоянной ролью и правилами.",
        "Форма пока является черновиком: данные появятся в списке только после сохранения.",
      ],
      route: APP_PATHS.automation.agents.create,
      placement: "left",
    },
    {
      id: "agents-main",
      target: "agent-form-main",
      title: "Название, описание и состояние",
      description:
        "Название помогает найти агента. Описание коротко говорит, за что он отвечает. Состояние определяет, можно ли его запускать.",
      points: [
        "Черновик ещё нельзя запускать.",
        "Активен — агент готов к работе.",
        "Отключён — агент сохранён, но временно недоступен.",
      ],
      route: APP_PATHS.automation.agents.create,
      placement: "left",
    },
    {
      id: "agents-instructions",
      target: "agent-form-instructions",
      title: "Инструкции объясняют, как работать",
      description:
        "Опишите роль, порядок действий, ограничения и вид готового результата обычными предложениями.",
      points: [
        "Скажите, что агент должен получить на входе.",
        "Перечислите основные шаги и случаи, когда нужно остановиться и спросить вас.",
        "Укажите формат ответа: список, таблица, файл или краткое резюме.",
      ],
      route: APP_PATHS.automation.agents.create,
      placement: "left",
    },
    {
      id: "agents-model",
      target: "agent-form-model",
      title: "Модель выполняет инструкции агента",
      description:
        "Выберите одну из включённых текстовых моделей. Если список пуст, сначала пройдите урок «Подключение модели».",
      route: APP_PATHS.automation.agents.create,
      placement: "left",
    },
    {
      id: "agents-tools",
      target: "agent-form-tools",
      title: "Возможности выдаются отдельно",
      description:
        "Отметьте только действия, без которых агент не справится. Возможность читать файлы не означает автоматический доступ ко всем папкам.",
      route: APP_PATHS.automation.agents.create,
      placement: "left",
    },
    {
      id: "agents-extra-tabs",
      target: "agent-form-tabs",
      title: "Дополнительные вкладки уточняют доступ",
      description:
        "Навыки добавляют памятки, директории ограничивают файлы, хранилище подключает документы, терминал разрешает команды, а память — сохранённые сведения.",
      points: [
        "Некоторые вкладки становятся доступны только после выбора соответствующего инструмента.",
        "Настройки агента могут только сузить общие разрешения приложения.",
      ],
      route: APP_PATHS.automation.agents.create,
      placement: "bottom",
    },
  ],
};
