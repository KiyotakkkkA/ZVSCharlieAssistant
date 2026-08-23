import { APP_PATHS, type AppPath } from "../../../app/routes";

export interface TourStep {
  id: string;
  target: string;
  title: string;
  description: string;
  route?: AppPath;
  placement?: "top" | "bottom" | "left" | "right";
  optional?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  { id: "sidebar", target: "sidebar", title: "Навигация", description: "Здесь собраны все разделы приложения; меню можно свернуть.", placement: "right" },
  { id: "chat", target: "nav-chat", title: "Чат", description: "Свободный диалог, планирование и запуск автоматизаций.", placement: "right" },
  { id: "modes", target: "chat-composer-mode", title: "Режимы ввода", description: "Переключайтесь между чатом, планировщиком, агентами и сценариями.", route: APP_PATHS.chat, placement: "top" },
  { id: "model", target: "chat-composer-model", title: "Модель", description: "Выберите модель, которая будет отвечать на запрос.", placement: "top", optional: true },
  { id: "tasks", target: "nav-tasks", title: "Задачи", description: "История запусков агентов и сценариев.", placement: "right" },
  { id: "agents", target: "nav-agents", title: "Агенты", description: "Исполнители с ролью, инструментами и навыками.", route: APP_PATHS.automation.agents.index, placement: "right" },
  { id: "tools", target: "nav-tools", title: "Инструменты", description: "Атомарные действия, которые можно выдать агенту.", placement: "right" },
  { id: "skills", target: "nav-skills", title: "Навыки", description: "Переиспользуемые инструкции, включая встроенные.", placement: "right" },
  { id: "scenarios", target: "nav-scenarios", title: "Сценарии", description: "Визуальные процессы из триггеров, условий и действий.", placement: "right" },
  { id: "secrets", target: "nav-secrets", title: "Секреты", description: "Защищённое хранилище ключей для интеграций.", placement: "right" },
  { id: "vector", target: "nav-vector-db", title: "Векторная БД", description: "Документы, по которым ассистент ищет ответы.", placement: "right" },
  { id: "policies", target: "nav-policies", title: "Политики", description: "Границы доступа к файлам и терминалу.", placement: "right" },
  { id: "settings", target: "header-settings", title: "Настройки", description: "Профиль, внешний вид и параметры приложения.", placement: "bottom" },
  { id: "checklist", target: "home-checklist", title: "Первые шаги", description: "Чеклист помогает постепенно подготовить приложение к работе.", route: APP_PATHS.home, placement: "bottom" },
] as const;
