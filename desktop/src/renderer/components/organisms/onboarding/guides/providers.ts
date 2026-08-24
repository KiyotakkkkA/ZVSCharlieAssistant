import { APP_PATHS } from "../../../../app/routes";
import { RobotIcon } from "../../../atoms";
import type { Guide } from "./types";

export const providersGuide: Guide = {
  id: "providers",
  title: "Провайдеры и модели",
  description: "Подключение сервиса, который отвечает в чате.",
  result: "Провайдер сохранён, связь проверена, хотя бы одна модель включена.",
  duration: "5 минут",
  icon: RobotIcon,
  recommendedBefore: ["beginning"],
  steps: [
    {
      id: "providers-purpose",
      target: "providers-page",
      title: "Провайдер и его модели",
      description:
        "Провайдер — это сервис, который выполняет запросы. Приложение само модели не содержит: без провайдера чат, агенты и базы знаний не работают.",
      points: [
        "Ollama запускает модели на этом компьютере: без интернета, но по мощности видеокарты.",
        "OpenRouter собирает модели разных компаний под одним ключом.",
        "Mistral подключает модели одноимённого сервиса напрямую.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-create",
      target: "provider-form",
      openTarget: "providers-add",
      title: "Форма подключения",
      description:
        "Форма открыта в режиме черновика. Пока не нажата кнопка сохранения, приложение не использует эти данные.",
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-connection",
      target: "provider-connection-fields",
      title: "Параметры подключения",
      description:
        "Название нужно только для списка. Поставщик определяет протокол запросов, адрес — куда они уходят.",
      points: [
        "Base API URL меняйте только для собственного сервера: у Ollama это обычно http://localhost:11434.",
        "Ключ API выбирается из раздела «Секреты», а не вводится текстом.",
        "Выключенный провайдер сохраняется, но его модели исчезают из всех списков.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-generation",
      target: "provider-generation-fields",
      title: "Параметры генерации",
      description:
        "Эти значения применяются ко всем запросам провайдера, пока агент или сценарий не переопределит их.",
      points: [
        "Максимум токенов — верхняя граница ответа: 1 токен ≈ 3 символа русского текста.",
        "Температура 0–0.3 даёт воспроизводимые ответы, 0.7–1.0 — вариативные формулировки.",
        "Top P управляет тем же разбросом другим способом: меняйте что-то одно.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-check",
      target: "provider-form",
      title: "Проверка связи",
      description:
        "Кнопка проверки вверху формы запрашивает у сервиса список моделей и ничего не сохраняет. Кнопка сохранения разблокируется после успешной проверки.",
      points: [
        "Ошибка авторизации — проверьте ключ и то, что выбран нужный секрет.",
        "Ошибка соединения — проверьте адрес и что локальный сервер запущен.",
        "Пустой список моделей у Ollama означает, что модель не загружена командой ollama pull.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-models",
      target: "provider-models",
      title: "Выбор моделей",
      description:
        "Список появляется после проверки. Включайте только те модели, которыми пользуетесь: остальные засоряют выбор в чате и настройках агентов.",
      points: [
        "Текстовые модели отвечают в диалоге, эмбеддинг-модели нужны базам знаний для поиска по смыслу.",
        "У OpenRouter есть отдельные фильтры бесплатных моделей и моделей, не обучающихся на запросах.",
        "Для базы знаний включите хотя бы одну эмбеддинг-модель — иначе документы не проиндексируются.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
  ],
};
