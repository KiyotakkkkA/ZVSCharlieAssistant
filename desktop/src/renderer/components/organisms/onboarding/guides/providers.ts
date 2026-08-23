import { APP_PATHS } from "../../../../app/routes";
import { RobotIcon } from "../../../atoms";
import type { Guide } from "./types";

export const providersGuide: Guide = {
  id: "providers",
  title: "Подключение модели",
  description: "Как подключить сервис, который будет отвечать в чате.",
  result: "Вы сможете выбрать модель и проверить, что она готова отвечать.",
  duration: "6 минут",
  icon: RobotIcon,
  recommendedBefore: ["beginning"],
  steps: [
    {
      id: "providers-purpose",
      target: "providers-page",
      title: "Сначала выберите способ подключения",
      description:
        "Провайдер даёт приложению доступ к моделям. Локальная модель работает на вашем компьютере, облачная — через интернет.",
      points: [
        "Ollama подходит для локальных и облачных моделей.",
        "OpenRouter предлагает модели разных компаний в одном месте.",
        "Mistral подключает модели сервиса Mistral.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-create",
      target: "provider-form",
      openTarget: "providers-add",
      title: "Откроем форму нового подключения",
      description:
        "Урок создал только временный черновик. Пока вы не нажмёте «Сохранить», он не попадёт в настройки приложения.",
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-connection",
      target: "provider-connection-fields",
      title: "Поля подключения",
      description:
        "Название нужно только вам. Поставщик определяет сервис, а адрес указывает, куда приложение отправляет запросы.",
      points: [
        "Название: любое понятное имя, например «Локальная модель».",
        "Поставщик: Ollama, OpenRouter или Mistral.",
        "Base API URL: обычно оставьте предложенный адрес; меняйте его только для собственного сервера.",
        "Ключ API: выберите ранее сохранённый секрет.",
        "Переключатель «Провайдер включён» определяет, будет ли подключение доступно приложению.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-generation",
      target: "provider-generation-fields",
      title: "Как будут выглядеть ответы",
      description:
        "Эти значения действуют по умолчанию. Если вы не уверены, оставьте предложенные настройки.",
      points: [
        "Максимум токенов — примерная верхняя граница длины ответа.",
        "Температура: ниже — спокойнее и точнее, выше — разнообразнее.",
        "Top P также управляет разнообразием. Обычно меняют либо его, либо температуру.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-check",
      target: "provider-form",
      title: "Проверьте связь перед сохранением",
      description:
        "Кнопка проверки находится вверху формы. Она ничего не сохраняет, а только пытается связаться с сервисом и получить список моделей.",
      points: [
        "Ошибка обычно означает неверный адрес, ключ или отсутствие интернета.",
        "После успешной проверки станет доступна кнопка сохранения.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-models",
      target: "provider-models",
      title: "Включите только нужные модели",
      description:
        "После проверки здесь появится список. В чатах и настройках агентов будут видны только включённые модели.",
      points: [
        "Поиск помогает найти модель по названию.",
        "Для OpenRouter можно отдельно показать бесплатные модели и модели, которые не используют запросы для обучения.",
        "Текстовые модели отвечают на вопросы, а модели поиска по смыслу нужны базам знаний.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
  ],
};
