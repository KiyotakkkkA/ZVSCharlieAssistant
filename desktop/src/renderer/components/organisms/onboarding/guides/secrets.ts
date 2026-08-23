import { APP_PATHS } from "../../../../app/routes";
import { LockIcon } from "../../../atoms";
import type { Guide } from "./types";

export const secretsGuide: Guide = {
  id: "secrets",
  title: "Пароли и ключи",
  description: "Как безопасно хранить данные для подключений.",
  result:
    "Вы сможете добавить ключ и использовать его, не вставляя значение в каждую настройку.",
  duration: "4 минуты",
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
    {
      id: "secrets-create",
      target: "secret-form",
      openTarget: "secrets-add",
      title: "Откроем форму нового секрета",
      description:
        "Открытие формы ничего не сохраняет. Запись появится только после заполнения и нажатия «Добавить».",
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
    {
      id: "secrets-name",
      target: "secret-form-name",
      title: "Название должно быть понятным, но не секретным",
      description:
        "Напишите, для чего используется запись, например «Ключ OpenRouter». Не вставляйте сам пароль в название.",
      points: ["Название видно в списках выбора, секретное значение — нет."],
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
    {
      id: "secrets-category",
      target: "secret-form-category",
      title: "Категория помогает поддерживать порядок",
      description:
        "Выберите группу, к которой относится запись. Так ключи моделей, почта и другие подключения не смешиваются в одном списке.",
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
    {
      id: "secrets-value",
      target: "secret-form-value",
      title: "Содержимое — сам пароль или ключ",
      description:
        "Вставьте значение без лишних пробелов. При редактировании пустое поле оставляет прежнее значение без изменений.",
      points: [
        "Не отправляйте это значение в чат.",
        "После сохранения выбирайте запись по названию в формах провайдеров и интеграций.",
      ],
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
  ],
};
