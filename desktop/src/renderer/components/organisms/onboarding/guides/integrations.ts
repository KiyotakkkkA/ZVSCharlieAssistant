import { APP_PATHS } from "../../../../app/routes";
import { TransitConnectionIcon } from "../../../atoms";
import type { Guide } from "./types";

export const integrationsGuide: Guide = {
  id: "integrations",
  order: 12,
  title: "Внешние сервисы",
  description: "Как связать приложение с почтой, мессенджерами и хранилищами кода.",
  result: "Вы поймёте, как добавить подключение и проверить его до использования.",
  duration: "3 минуты",
  icon: TransitConnectionIcon,
  recommendedBefore: ["secrets", "scenarios"],
  steps: [
    {
      id: "integrations-connections",
      target: "integrations-page",
      title: "Интеграции связывают приложение с другими сервисами",
      description:
        "Подключение может получать события или отправлять результаты. Например, сценарий может начаться с нового сообщения и закончиться отправкой ответа.",
      points: [
        "Сначала сохраните нужный пароль или ключ в разделе секретов.",
        "Всегда проверяйте подключение перед использованием в сценарии.",
      ],
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
  ],
};
