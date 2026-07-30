import type { SvgIcon } from "../components/atoms";
import {
  ChatIcon,
  HomeIcon,
  SettingsIcon,
  StorageIcon,
  TasksIcon,
} from "../components/atoms";

export const APP_PATHS = {
  home: "/",
  chat: "/chat",
  tasks: "/tasks",
  storage: "/storage",
  settings: "/settings",
} as const;

export type AppPath = (typeof APP_PATHS)[keyof typeof APP_PATHS];

export interface NavigationRoute {
  id: keyof typeof APP_PATHS;
  label: string;
  path: AppPath;
  icon: SvgIcon;
}

export const NAVIGATION_ROUTES: readonly NavigationRoute[] = [
  { id: "home", label: "Главная", path: APP_PATHS.home, icon: HomeIcon },
  { id: "chat", label: "Чат", path: APP_PATHS.chat, icon: ChatIcon },
  { id: "tasks", label: "Задачи", path: APP_PATHS.tasks, icon: TasksIcon },
  { id: "storage", label: "Хранилище", path: APP_PATHS.storage, icon: StorageIcon },
  { id: "settings", label: "Настройки", path: APP_PATHS.settings, icon: SettingsIcon },
] as const;
