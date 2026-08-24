import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { Button, Separator, Tooltip } from "@kiyotakkkka/zvs-uikit-lib";
import { useAppNavigation } from "../../hooks";
import { NavigationTreeItem } from "../molecules";
import {
  ArrowExpandRightIcon,
  ArrowExpandLeftIcon,
  ZVSLogoIcon,
} from "../atoms";
import type { NavigationRoute } from "../../app/routes";

function leafRoutes(routes: readonly NavigationRoute[]): NavigationRoute[] {
  return routes.flatMap((route) =>
    route.children?.length
      ? leafRoutes(route.children)
      : route.path
        ? [route]
        : [],
  );
}

export const NavigationSidebar = () => {
  const { currentPath, routes } = useAppNavigation();
  const [collapsed, setCollapsed] = useState(false);
  const [navigationVisible, setNavigationVisible] = useState(true);
  const transitionTimers = useRef<number[]>([]);
  const compactRoutes = leafRoutes(routes);

  useEffect(
    () => () => {
      transitionTimers.current.forEach(window.clearTimeout);
    },
    [],
  );

  const toggleCollapsed = () => {
    if (!navigationVisible) return;
    setNavigationVisible(false);
    transitionTimers.current.push(
      window.setTimeout(() => {
        setCollapsed((value) => !value);
        transitionTimers.current.push(
          window.setTimeout(() => setNavigationVisible(true), 300),
        );
      }, 140),
    );
  };

  return (
    <aside
      data-tour="sidebar"
      className={[
        "relative shrink-0 overflow-visible rounded-xl p-2 shadow-sm",
        "transition-[width,background-color] duration-300 ease-out bg-main-800/40 space-y-2",
        collapsed ? "w-14" : "w-60",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-9 items-center font-medium text-main-100",
          collapsed ? "justify-center" : "justify-between px-1",
        ].join(" ")}
      >
        <div
          className={[
            "whitespace-nowrap transition-[opacity,width] duration-200",
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
          ].join(" ")}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
            <ZVSLogoIcon className="size-8" />
          </span>
        </div>
        <Tooltip
          label={collapsed ? "Развернуть меню" : "Свернуть меню"}
          placement="bottom-left"
        >
          <Button
            variant="ghost"
            rounded="rounded-lg"
            label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            className="inline-flex size-9 shrink-0 items-center justify-center border-0! p-0 text-main-400 shadow-none ring-0! hover:bg-main-600/50 hover:text-main-50"
            disabled={!navigationVisible}
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <ArrowExpandRightIcon className="size-5" />
            ) : (
              <ArrowExpandLeftIcon className="size-5" />
            )}
          </Button>
        </Tooltip>
      </div>

      <div
        className={[
          "transition-opacity duration-150",
          navigationVisible
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none overflow-hidden opacity-0",
        ].join(" ")}
      >
        <nav
          aria-label="Основная навигация"
          className={collapsed ? "space-y-1 overflow-visible" : "space-y-0.5"}
        >
          {collapsed
            ? compactRoutes.map((route) => {
                const RouteIcon = route.icon;
                return (
                  <Tooltip
                    key={route.id}
                    label={route.label}
                    placement="bottom-left"
                    className="block"
                  >
                    <NavLink
                      data-tour={`nav-${route.id.replace(/^(automation|storage|settings)-/, "")}`}
                      to={route.path!}
                      aria-label={route.label}
                      className={({ isActive }) =>
                        [
                          "group grid size-10 place-items-center rounded-lg outline-none",
                          "transition-colors duration-150 hover:bg-main-700/70",
                          isActive
                            ? "bg-main-700/70 text-main-50"
                            : "text-main-400 hover:text-main-100",
                        ].join(" ")
                      }
                    >
                      <RouteIcon className="size-5" />
                    </NavLink>
                  </Tooltip>
                );
              })
            : routes.map((route) => (
                <NavigationTreeItem
                  key={route.id}
                  node={route}
                  currentPath={currentPath}
                />
              ))}
        </nav>
      </div>
    </aside>
  );
};
