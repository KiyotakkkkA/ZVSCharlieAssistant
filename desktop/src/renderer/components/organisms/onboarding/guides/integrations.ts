import { APP_PATHS } from "../../../../app/routes";
import { TransitConnectionIcon } from "../../../atoms";
import type { Guide } from "./types";

export const integrationsGuide: Guide = {
  id: "integrations",
  title: "Интеграции",
  description: "Связь с почтой, мессенджерами и хранилищами кода.",
  result:
    "Подключение сохранено и проверено, готово к использованию в сценарии.",
  duration: "5 минут",
  icon: TransitConnectionIcon,
  recommendedBefore: ["secrets", "scenarios"],
  steps: [
    {
      id: "integrations-connections",
      target: "integrations-page",
      title: "Вход и выход сценария",
      description:
        "Интеграция работает с двух сторон: приносит события в триггер сценария и отправляет наружу результат. Новое письмо запускает процесс, ответ уходит в Telegram.",
      points: [
        "Сначала сохраните токен или пароль в разделе «Секреты» — форма подключения берёт значение оттуда.",
      ],
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
    {
      id: "integrations-create",
      target: "integration-form",
      openTarget: "integrations-add",
      title: "Форма подключения",
      description:
        "Вкладка выбирает тип: бот, почта или хранилище кода. Форма открыта в режиме черновика на примере Telegram-бота.",
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
    {
      id: "integrations-fields",
      target: "integration-connection-fields",
      title: "Параметры подключения",
      description:
        "Название нужно только для списка, поставщик определяет протокол, токен выбирается из секретов.",
      points: [
        "Токен Telegram выдаёт BotFather — сохраните его как секрет до заполнения формы.",
        "Почте нужны адрес сервера, порт, имя пользователя и пароль.",
        "GitHub и GitLab требуют адрес сервиса, проект и ключ доступа.",
      ],
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
    {
      id: "integrations-check",
      target: "integration-form",
      title: "Проверка подключения",
      description:
        "Кнопка проверки вверху формы выполняет вход в сервис и ничего не отправляет получателям. Для Telegram она возвращает имя бота и его идентификатор.",
      points: [
        "Ошибка авторизации у почты чаще всего означает, что нужен пароль приложения, а не основной пароль.",
        "После сохранения подключение появляется в триггерах и узлах доставки сценария.",
      ],
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
  ],
};
