import { APP_PATHS } from "../../../../app/routes";
import { TransitConnectionIcon } from "../../../atoms";
import type { Guide } from "./types";

export const integrationsGuide: Guide = {
  id: "integrations",
  title: "Внешние сервисы",
  description: "Как связать приложение с почтой, мессенджерами и хранилищами кода.",
  result: "Вы поймёте, как добавить подключение и проверить его до использования.",
  duration: "6 минут",
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
    {
      id: "integrations-create",
      target: "integration-form",
      openTarget: "integrations-add",
      title: "Откроем форму подключения",
      description:
        "Вкладка определяет вид нового подключения: бот, почта или сервис хранения кода. Урок открывает безопасный черновик Telegram-бота.",
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
    {
      id: "integrations-fields",
      target: "integration-connection-fields",
      title: "Поля подключения бота",
      description:
        "Название видно только вам. Поставщик указывает сервис. Токен выбирается из защищённых секретов, а переключатель включает использование подключения.",
      points: [
        "Токен Telegram выдаёт BotFather — сначала сохраните его как секрет.",
        "Для почты понадобятся адрес сервера, порт, имя пользователя и пароль.",
        "Для GitHub или GitLab понадобятся адрес сервиса, проект и ключ доступа.",
      ],
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
    {
      id: "integrations-check",
      target: "integration-form",
      title: "Проверьте подключение до сохранения",
      description:
        "Кнопка проверки вверху формы покажет, удалось ли войти в сервис. Для Telegram после проверки появятся имя бота и его идентификатор.",
      points: [
        "Проверка не создаёт сценарий и ничего не отправляет.",
        "После сохранения подключение можно выбрать в начале или конце сценария.",
      ],
      route: APP_PATHS.settings.integrations,
      placement: "left",
    },
  ],
};
