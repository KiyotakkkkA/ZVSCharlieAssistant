import type { SvgIcon } from "../components/atoms";
import {
  ChatIcon,
  HomeIcon,
  LockIcon,
  RobotIcon,
  SettingsIcon,
  StorageIcon,
  TasksIcon,
} from "../components/atoms";

export const APP_PATHS = {
  home: "/",
  chat: "/chat",
  tasks: "/tasks",
  agents: "/agents",
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
  { id: "agents", label: "Агенты", path: APP_PATHS.agents, icon: RobotIcon },
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
