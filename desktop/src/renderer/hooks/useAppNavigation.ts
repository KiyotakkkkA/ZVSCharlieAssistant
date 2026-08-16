import { useCallback } from "react";
import {
  useLocation,
  useNavigate,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { APP_PATHS, NAVIGATION_ROUTES, type AppPath } from "../app/routes";

/**
 * Единая точка навигации приложения поверх react-router. Прежнее имя
 * `useAppNavigation` заставляло думать, что это самостоятельный роутер, тогда как
 * часть компонентов ходила в react-router напрямую — два стиля в одной базе.
 */
export function useAppNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = useCallback(
    (path: To, options?: NavigateOptions) => {
      void navigate(path, options);
    },
    [navigate],
  );

  const goBack = useCallback(
    (fallback: To = APP_PATHS.home) => {
      const historyIndex = window.history.state?.idx;
      if (typeof historyIndex === "number" && historyIndex > 0) {
        void navigate(-1);
        return;
      }
      void navigate(fallback, { replace: true });
    },
    [navigate],
  );

  const isActive = useCallback(
    (path: AppPath) =>
      path === APP_PATHS.home
        ? location.pathname === path
        : location.pathname.startsWith(path),
    [location.pathname],
  );

  return {
    currentPath: location.pathname,
    routes: NAVIGATION_ROUTES,
    goTo,
    goBack,
    isActive,
  } as const;
}
