import { useCallback } from "react";
import {
  useLocation,
  useNavigate,
  type NavigateOptions,
  type To,
} from "react-router-dom";
import { APP_PATHS, NAVIGATION_ROUTES, type AppPath } from "../app/routes";

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
    (fallback: To = APP_PATHS.chat) => {
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
    (path: AppPath) => location.pathname.startsWith(path),
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
