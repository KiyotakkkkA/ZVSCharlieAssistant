import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { App } from "./app/App";
import { APP_PATHS } from "./app/routes";
import { RoutePage } from "./pages/RoutePage";
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
          <Route path={APP_PATHS.chat} element={<RoutePage title="Чат" />} />
          <Route path={APP_PATHS.tasks} element={<RoutePage title="Задачи" />} />
          <Route path={APP_PATHS.storage} element={<RoutePage title="Хранилище" />} />
          <Route path={APP_PATHS.settings} element={<RoutePage title="Настройки" />} />
          <Route path="*" element={<Navigate to={APP_PATHS.home} replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
);
