import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { App } from "./app/App";
import { APP_PATHS } from "./app/routes";
import { RoutePage } from "./pages/RoutePage";
import {
  AgentManagerPage,
  AgentsListPage,
} from "./pages/automation/agents";
import {
  ScenarioGraphEditorPage,
  ScenariosListPage,
} from "./pages/automation/scenarios";
import { ToolsListPage } from "./pages/automation/tools";
import { StorageSecretsPage } from "./pages/storage";
import { ChatPage } from "./pages/chat";
import "@fontsource-variable/onest";
import "./styles/global.css";

const root = document.getElementById("root");

if (!root) throw new Error("Root element was not found");

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<RoutePage title="Главная" />} />
          <Route path={APP_PATHS.chat} element={<ChatPage />} />
          <Route
            path={APP_PATHS.tasks}
            element={<RoutePage title="Задачи" />}
          />
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
            path={APP_PATHS.automation.scenarios.index}
            element={<ScenariosListPage />}
          />
          <Route
            path={APP_PATHS.automation.scenarios.create}
            element={<ScenarioGraphEditorPage />}
          />
          <Route
            path={APP_PATHS.automation.scenarios.edit}
            element={<ScenarioGraphEditorPage />}
          />
          <Route
            path={APP_PATHS.storage.index}
            element={<RoutePage title="Хранилище" />}
          />
          <Route
            path={APP_PATHS.settings}
            element={<RoutePage title="Настройки" />}
          />
          <Route
            path={APP_PATHS.storage.secrets}
            element={<StorageSecretsPage />}
          />
          <Route path="*" element={<Navigate to={APP_PATHS.home} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
