import { APP_PATHS } from "../../../../app/routes";
import { LockIcon } from "../../../atoms";
import type { Guide } from "./types";

export const secretsGuide: Guide = {
  id: "secrets",
  title: "Секреты",
  description: "Хранение ключей и паролей отдельно от настроек.",
  result:
    "Ключ сохранён и подставляется в провайдеры и интеграции по названию.",
  duration: "3 минуты",
  icon: LockIcon,
  recommendedBefore: ["providers"],
  steps: [
    {
      id: "secrets-storage",
      target: "secrets-page",
      title: "Зачем отдельное хранилище",
      description:
        "Секрет хранится в зашифрованном виде и подставляется в подключения по названию. Формы провайдеров и интеграций показывают только название, но не значение.",
      points: [
        "Ключ, вписанный в инструкцию агента или в сообщение чата, уходит в модель вместе с текстом.",
        "Экспорт данных переносит секреты только под отдельным паролем.",
      ],
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
    {
      id: "secrets-create",
      target: "secret-form",
      openTarget: "secrets-add",
      title: "Форма записи",
      description:
        "Форма открыта в режиме черновика. Запись появится в списке после нажатия кнопки добавления.",
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
    {
      id: "secrets-name",
      target: "secret-form-name",
      title: "Название записи",
      description:
        "Название видно во всех списках выбора, поэтому пишите назначение: «Ключ OpenRouter», «Токен рабочего бота».",
      points: [
        "Само значение ключа в название не вставляют: список секретов виден целиком.",
      ],
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
    {
      id: "secrets-category",
      target: "secret-form-category",
      title: "Категория",
      description:
        "Категория группирует записи в списках выбора. На десятке ключей это экономит время, на трёх — нет.",
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
    {
      id: "secrets-value",
      target: "secret-form-value",
      title: "Значение",
      description:
        "Вставьте ключ без пробелов и переносов по краям. При редактировании пустое поле оставляет прежнее значение.",
      points: [
        "Значение не показывается после сохранения: потерянный ключ перевыпускается в сервисе.",
        "Если провайдер отвечает ошибкой авторизации — чаще всего в значение попал лишний пробел.",
      ],
      route: APP_PATHS.storage.secrets,
      placement: "left",
    },
  ],
};
