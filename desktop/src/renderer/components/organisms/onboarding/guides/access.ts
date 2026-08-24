import { APP_PATHS } from "../../../../app/routes";
import { PolicyIcon } from "../../../atoms";
import type { Guide } from "./types";

export const accessGuide: Guide = {
  id: "access",
  title: "Политики",
  description: "Границы доступа к файлам, командам и памяти.",
  result:
    "Заданы папки, команды и правила подтверждения, дальше которых агент не выйдет.",
  duration: "6 минут",
  icon: PolicyIcon,
  recommendedBefore: ["agents", "tools"],
  steps: [
    {
      id: "access-policies",
      target: "policies-page",
      title: "Общий предел прав",
      description:
        "Политики задают максимум, доступный приложению. Агент и сценарий получают подмножество этих прав и никогда не выходят за них.",
      points: [
        "Выдавайте рабочую папку проекта, а не диск целиком.",
        "Расширять правила проще по факту отказа, чем сужать после инцидента.",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
    {
      id: "access-terminal",
      target: "policy-form-terminal",
      openTarget: "policies-tabs",
      openLabel: "Работа с терминалом",
      title: "Терминал",
      description:
        "Вкладка включает выполнение команд и задаёт общие ограничения для всех агентов и сценариев.",
      points: [
        "Список разрешённых команд — единственные программы, которые удастся запустить.",
        "Режим подтверждения определяет, когда приложение остановится и спросит вас.",
        "Таймаут прерывает зависшую команду; рабочая директория задаёт папку запуска.",
        "Отказ в выполнении показывает, какая команда или путь заблокированы — добавляйте их точечно.",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
    {
      id: "access-directories",
      target: "policy-form-directories",
      openTarget: "policies-tabs",
      openLabel: "Разрешённые директории",
      title: "Директории",
      description:
        "Каждая запись задаёт путь и разрешённые внутри него действия.",
      points: [
        "Чтение открывает просмотр, запись — создание и изменение файлов.",
        "Удаление включайте только под конкретную задачу.",
        "Доступ к вложенным папкам распространяет правило на всё дерево ниже пути.",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
    {
      id: "access-memory",
      target: "policy-form-memory",
      openTarget: "policies-tabs",
      openLabel: "Память",
      title: "Память",
      description:
        "Память хранит факты о вас между диалогами. Автосохранение разрешает ассистенту предлагать новые записи самому.",
      points: [
        "Ограничения количества и размера не дают памяти расти бесконтрольно.",
        "Ключи и пароли в память не пишут — для них есть раздел «Секреты».",
      ],
      route: APP_PATHS.settings.policies,
      placement: "left",
    },
  ],
};
