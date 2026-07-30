import type { SvgIcon } from "../components/atoms";
import {
  ChatIcon,
  HomeIcon,
  LockIcon,
  SettingsIcon,
  StorageIcon,
  TasksIcon,
} from "../components/atoms";

export const APP_PATHS = {
  home: "/",
  chat: "/chat",
  tasks: "/tasks",
  storage: "/storage",
  settings: {
    index: "/settings",
    secrets: "/settings/secrets",
  },
} as const;

type LeafPath<T> = T extends string
  ? T
  : T extends Readonly<Record<string, unknown>>
    ? { [Key in keyof T]: LeafPath<T[Key]> }[keyof T]
    : never;

export type AppPath = LeafPath<typeof APP_PATHS>;

export interface NavigationRoute {
  id: string;
  label: string;
  icon: SvgIcon;
  path?: AppPath;
  children?: readonly NavigationRoute[];
}

export const NAVIGATION_ROUTES: readonly NavigationRoute[] = [
  { id: "home", label: "Главная", path: APP_PATHS.home, icon: HomeIcon },
  { id: "chat", label: "Чат", path: APP_PATHS.chat, icon: ChatIcon },
  { id: "tasks", label: "Задачи", path: APP_PATHS.tasks, icon: TasksIcon },
  {
    id: "storage",
    label: "Хранилище",
    path: APP_PATHS.storage,
    icon: StorageIcon,
  },
  {
    id: "settings",
    label: "Настройки",
    icon: SettingsIcon,
    children: [
      {
        id: "settings-secrets",
        label: "Секреты",
        path: APP_PATHS.settings.secrets,
        icon: LockIcon,
      },
    ],
  },
] as const;
