import { APP_PATHS } from "../../../../app/routes";
import { PolicyIcon } from "../../../atoms";
import type { Guide } from "./types";

export const accessGuide: Guide = {
  id: "access",
  title: "Безопасный доступ",
  description: "Как ограничить папки и команды, доступные помощникам.",
  result: "Вы сможете задать безопасные границы для работы агентов и сценариев.",
  duration: "7 минут",
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
    {
      id: "access-terminal",
      target: "policy-form-terminal",
      openTarget: "policies-tabs",
      openLabel: "Работа с терминалом",
      title: "Команды компьютера требуют отдельных правил",
      description:
        "Здесь включается работа с терминалом и задаются общие ограничения для всех агентов и сценариев.",
      points: [
        "Разрешённые команды — единственные программы, которые можно запускать.",
        "Режим подтверждения определяет, когда приложение должно спросить вашего разрешения.",
        "Таймаут останавливает команду, если она работает слишком долго.",
        "Рабочая директория задаёт папку, из которой запускается команда.",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
    {
      id: "access-directories",
      target: "policy-form-directories",
      openTarget: "policies-tabs",
      openLabel: "Разрешённые директории",
      title: "Разрешайте только нужные папки",
      description:
        "Каждая запись задаёт путь и действия, которые разрешены внутри него.",
      points: [
        "Чтение позволяет просматривать файлы, запись — изменять и создавать их.",
        "Удаление лучше включать только при явной необходимости.",
        "Доступ к вложенным папкам распространяет правило глубже выбранной директории.",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
    {
      id: "access-memory",
      target: "policy-form-memory",
      openTarget: "policies-tabs",
      openLabel: "Память",
      title: "Память хранит полезные сведения между разговорами",
      description:
        "Общий переключатель включает память. Автосохранение разрешает помощнику самому предлагать новые записи.",
      points: [
        "Ограничение количества и размера не даёт памяти бесконтрольно расти.",
        "Чувствительные данные лучше не сохранять в память — для ключей предназначены секреты.",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
  ],
};
