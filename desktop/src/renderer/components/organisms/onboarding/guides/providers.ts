import { APP_PATHS } from "../../../../app/routes";
import { RobotIcon } from "../../../atoms";
import type { Guide } from "./types";

export const providersGuide: Guide = {
  id: "providers",
  order: 2,
  title: "Подключение модели",
  description: "Как подключить сервис, который будет отвечать в чате.",
  result: "Вы сможете выбрать модель и проверить, что она готова отвечать.",
  duration: "3 минуты",
  icon: RobotIcon,
  recommendedBefore: ["beginning"],
  steps: [
    {
      id: "providers-purpose",
      target: "providers-page",
      title: "Модель — это собеседник приложения",
      description:
        "Чтобы чат отвечал, нужно подключить хотя бы один сервис с моделями. Это похоже на добавление почтового ящика в почтовую программу.",
      points: [
        "Ollama может запускать модели на вашем компьютере, а также даёт доступ к облачным моделям по ключу.",
        "OpenRouter и Mistral работают через интернет и обычно требуют ключ доступа.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
    {
      id: "providers-connection",
      target: "providers-workspace",
      title: "Сначала проверьте подключение",
      description:
        "Добавьте провайдера, заполните адрес и ключ, если он нужен, затем нажмите кнопку проверки. После успешной проверки включите нужную модель.",
      points: [
        "Ключ хранится в защищённом хранилище.",
        "В чат попадут только модели, которые вы включили.",
      ],
      route: APP_PATHS.settings.providers,
      placement: "left",
    },
  ],
};
