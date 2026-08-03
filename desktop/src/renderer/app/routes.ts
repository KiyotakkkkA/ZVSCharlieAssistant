import type { SvgIcon } from "../components/atoms";
import {
  ChatIcon,
  FactoryIcon,
  GraphIcon,
  HomeIcon,
  LockIcon,
  NumbersIcon,
  RobotIcon,
  ScriptIcon,
  SkillIcon,
  SettingsIcon,
  StorageIcon,
  TasksIcon,
  ToolsIcon,
} from "../components/atoms";

export const APP_PATHS = {
  home: "/",
  chat: "/chat",
  tasks: "/tasks",
  automation: {
    index: "/automation",
    agents: {
      index: "/automation/agents",
      create: "/automation/agents/new",
      edit: "/automation/agents/:agentId",
    },
    tools: "/automation/tools",
    skills: {
      index: "/automation/skills",
      create: "/automation/skills/new",
      edit: "/automation/skills/:skillId",
    },
    scenarios: {
      index: "/automation/scenarios",
      create: "/automation/scenarios/new",
      edit: "/automation/scenarios/:scenarioId",
    },
  },
  storage: {
    index: "/storage",
    secrets: "/storage/secrets",
    vectorDb: "/storage/vector-db",
  },
  settings: {
    index: "/settings",
    providers: "/settings/providers",
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
    id: "automation",
    label: "Автоматизация",
    icon: FactoryIcon,
    children: [
      {
        id: "automation-agents",
        label: "Агенты",
        path: APP_PATHS.automation.agents.index,
        icon: GraphIcon,
      },
      {
        id: "automation-tools",
        label: "Инструменты",
        path: APP_PATHS.automation.tools,
        icon: ToolsIcon,
      },
      {
        id: "automation-scenarios",
        label: "Сценарии",
        path: APP_PATHS.automation.scenarios.index,
        icon: ScriptIcon,
      },
      {
        id: "automation-skills",
        label: "Навыки",
        path: APP_PATHS.automation.skills.index,
        icon: SkillIcon,
      },
    ],
  },
  {
    id: "storage",
    label: "Хранилище",
    icon: StorageIcon,
    children: [
      {
        id: "storage-secrets",
        label: "Секреты",
        path: APP_PATHS.storage.secrets,
        icon: LockIcon,
      },
      {
        id: "storage-vector-db",
        label: "Векторная БД",
        path: APP_PATHS.storage.vectorDb,
        icon: NumbersIcon,
      },
    ],
  },
  {
    id: "settings",
    label: "Настройки",
    icon: SettingsIcon,
    children: [
      {
        id: "settings-providers",
        label: "Провайдеры",
        path: APP_PATHS.settings.providers,
        icon: RobotIcon,
      },
    ],
  },
] as const;
