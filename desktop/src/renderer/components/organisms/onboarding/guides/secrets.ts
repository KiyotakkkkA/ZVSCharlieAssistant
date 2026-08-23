import { APP_PATHS } from "../../../../app/routes";
import { LockIcon } from "../../../atoms";
import type { Guide } from "./types";

export const secretsGuide: Guide = {
  id: "secrets",
  order: 9,
  title: "Пароли и ключи",
  description: "Как безопасно хранить данные для подключений.",
  result: "Вы сможете добавить ключ и использовать его, не вставляя значение в каждую настройку.",
  duration: "2 минуты",
  icon: LockIcon,
  recommendedBefore: ["providers"],
  steps: [
    {
      id: "secrets-storage",
      target: "secrets-page",
      title: "Секреты хранятся отдельно",
      description:
        "Ключи и пароли сохраняются в защищённом месте. В настройках провайдера или интеграции выбирается нужная запись, а само значение не показывается.",
      points: [
        "Давайте записям понятные названия, например «Рабочая почта».",
        "Не храните ключи в описаниях, сообщениях и инструкциях агентов.",
      ],
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
  ],
};
