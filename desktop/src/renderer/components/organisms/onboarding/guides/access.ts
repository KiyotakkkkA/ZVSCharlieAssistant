import { APP_PATHS } from "../../../../app/routes";
import { PolicyIcon } from "../../../atoms";
import type { Guide } from "./types";

export const accessGuide: Guide = {
  id: "access",
  order: 11,
  title: "Безопасный доступ",
  description: "Как ограничить папки и команды, доступные помощникам.",
  result: "Вы сможете задать безопасные границы для работы агентов и сценариев.",
  duration: "3 минуты",
  icon: PolicyIcon,
  recommendedBefore: ["agents", "tools"],
  steps: [
    {
      id: "access-policies",
      target: "policies-page",
      title: "Политики задают общие границы",
      description:
        "Здесь выбираются папки и команды, которые в принципе разрешены приложению. Отдельный агент может получить меньше прав, но не больше.",
      points: [
        "Добавляйте рабочую папку проекта, а не весь диск.",
        "Начните с рекомендуемых правил команд и расширяйте их только при необходимости.",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
  ],
};
