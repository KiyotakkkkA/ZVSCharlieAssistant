import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { Loader, ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import { App } from "./app/App";
import {
  applyThemePaletteToDocument,
  loadThemePaletteFromStorage,
} from "./app/theme";
import {
  applyTypographyToDocument,
  loadTypographyFromStorage,
} from "./app/typography";
import { APP_PATHS } from "./app/routes";
import { Header, NavigationSidebar } from "./components/layouts";
import { RoutePage } from "./pages/RoutePage";
import "@fontsource-variable/onest";
import "./styles/global.css";

const ChatPage = lazy(() =>
  import("./pages/chat").then(({ ChatPage }) => ({ default: ChatPage })),
);
const TaskListPage = lazy(() =>
  import("./pages/tasks").then(({ TaskListPage }) => ({
    default: TaskListPage,
  })),
);
const ScenarioExecHistoryPage = lazy(() =>
  import("./pages/automation/scenarios").then(
    ({ ScenarioExecHistoryPage }) => ({
      default: ScenarioExecHistoryPage,
    }),
  ),
);
const AgentsListPage = lazy(() =>
  import("./pages/automation/agents").then(({ AgentsListPage }) => ({
    default: AgentsListPage,
  })),
);
const AgentManagerPage = lazy(() =>
  import("./pages/automation/agents").then(({ AgentManagerPage }) => ({
    default: AgentManagerPage,
  })),
);
const ToolsListPage = lazy(() =>
  import("./pages/automation/tools").then(({ ToolsListPage }) => ({
    default: ToolsListPage,
  })),
);
const ScenariosListPage = lazy(() =>
  import("./pages/automation/scenarios").then(({ ScenariosListPage }) => ({
    default: ScenariosListPage,
  })),
);
const ScenarioGraphEditorPage = lazy(() =>
  import("./pages/automation/scenarios").then(
    ({ ScenarioGraphEditorPage }) => ({ default: ScenarioGraphEditorPage }),
  ),
);
const SkillsListPage = lazy(() =>
  import("./pages/automation/skills").then(({ SkillsListPage }) => ({
    default: SkillsListPage,
  })),
);
const SkillManagerPage = lazy(() =>
  import("./pages/automation/skills").then(({ SkillManagerPage }) => ({
    default: SkillManagerPage,
  })),
);
const StorageSecretsPage = lazy(() =>
  import("./pages/storage/secrets").then(({ StorageSecretsPage }) => ({
    default: StorageSecretsPage,
  })),
);
const VectorStoresPage = lazy(() =>
  import("./pages/storage/vector-store").then(({ VectorStoresPage }) => ({
    default: VectorStoresPage,
  })),
);
const SettingsProvidersPage = lazy(() =>
  import("./pages/settings/providers").then(({ SettingsProvidersPage }) => ({
    default: SettingsProvidersPage,
  })),
);
const SettingsPoliciesPage = lazy(() =>
  import("./pages/settings/policies").then(({ SettingsPoliciesPage }) => ({
    default: SettingsPoliciesPage,
  })),
);
const SettingsIntegrationsPage = lazy(() =>
  import("./pages/settings/integrations").then(
    ({ SettingsIntegrationsPage }) => ({ default: SettingsIntegrationsPage }),
  ),
);

function AppLayout() {
  const { pathname } = useLocation();
  const ownsContentScroll =
    pathname === APP_PATHS.chat ||
    pathname.startsWith(APP_PATHS.tasks) ||
    pathname === APP_PATHS.automation.agents.index ||
    pathname === APP_PATHS.automation.tools ||
    pathname === APP_PATHS.automation.skills.index ||
    pathname === APP_PATHS.automation.scenarios.index ||
    pathname.startsWith(`${APP_PATHS.automation.scenarios.index}/`) ||
    pathname === APP_PATHS.storage.secrets ||
    pathname === APP_PATHS.storage.vectorDb ||
    pathname === APP_PATHS.settings.policies ||
    pathname === APP_PATHS.settings.integrations;

  const content = (
    <Suspense
      fallback={
        <div className="grid h-full min-h-0 place-items-center">
          <Loader />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );

  return (
    <div className="flex h-screen gap-3 p-3">
      <NavigationSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Header />
        <main className="min-h-0 flex-1 overflow-hidden rounded-lg bg-main-800/40">
          {ownsContentScroll ? (
            <div className="h-full min-h-0 overflow-hidden">{content}</div>
          ) : (
            <ScrollArea className="h-full">{content}</ScrollArea>
          )}
        </main>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
const initialPalette = loadThemePaletteFromStorage();

if (initialPalette) {
  applyThemePaletteToDocument(initialPalette);
}
applyTypographyToDocument(loadTypographyFromStorage());

if (!root) throw new Error("Root element was not found");

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App initialPalette={initialPalette ?? undefined} />}>
          <Route element={<AppLayout />}>
            <Route
              index
              element={
                <RoutePage
                  title="Главная"
                  description="Начните с чата или откройте раздел автоматизации в боковом меню."
                />
              }
            />
            <Route path={APP_PATHS.chat} element={<ChatPage />} />
            <Route path={APP_PATHS.tasks} element={<TaskListPage />} />
            <Route
              path={APP_PATHS.automation.index}
              element={
                <Navigate to={APP_PATHS.automation.agents.index} replace />
              }
            />
            <Route
              path={APP_PATHS.automation.agents.index}
              element={<AgentsListPage />}
            />
            <Route
              path={APP_PATHS.automation.agents.create}
              element={<AgentManagerPage />}
            />
            <Route
              path={APP_PATHS.automation.agents.edit}
              element={<AgentManagerPage />}
            />
            <Route
              path={APP_PATHS.automation.tools}
              element={<ToolsListPage />}
            />
            <Route
              path={APP_PATHS.automation.skills.index}
              element={<SkillsListPage />}
            />
            <Route
              path={APP_PATHS.automation.skills.create}
              element={<SkillManagerPage />}
            />
            <Route
              path={APP_PATHS.automation.skills.edit}
              element={<SkillManagerPage />}
            />
            <Route
              path={APP_PATHS.automation.scenarios.index}
              element={<ScenariosListPage />}
            />
            <Route
              path={APP_PATHS.automation.scenarios.create}
              element={<ScenarioGraphEditorPage />}
            />
            <Route
              path={APP_PATHS.automation.scenarios.execution}
              element={<ScenarioExecHistoryPage />}
            />
            <Route
              path={APP_PATHS.automation.scenarios.edit}
              element={<ScenarioGraphEditorPage />}
            />
            <Route
              path={APP_PATHS.storage.index}
              element={<Navigate to={APP_PATHS.storage.vectorDb} replace />}
            />
            <Route
              path={APP_PATHS.settings.index}
              element={<Navigate to={APP_PATHS.settings.providers} replace />}
            />
            <Route
              path={APP_PATHS.settings.providers}
              element={<SettingsProvidersPage />}
            />
            <Route
              path={APP_PATHS.settings.policies}
              element={<SettingsPoliciesPage />}
            />
            <Route
              path={APP_PATHS.settings.integrations}
              element={<SettingsIntegrationsPage />}
            />
            <Route
              path={APP_PATHS.storage.secrets}
              element={<StorageSecretsPage />}
            />
            <Route
              path={APP_PATHS.storage.vectorDb}
              element={<VectorStoresPage />}
            />
            <Route
              path="*"
              element={<Navigate to={APP_PATHS.home} replace />}
            />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
