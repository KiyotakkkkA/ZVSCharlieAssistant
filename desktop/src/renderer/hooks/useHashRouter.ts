import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  APP_PATHS,
  NAVIGATION_ROUTES,
  type AppPath,
} from "../app/routes";

export function useHashRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  const goTo = useCallback(
    (path: AppPath) => {
      void navigate(path);
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
    isActive,
  } as const;
}
