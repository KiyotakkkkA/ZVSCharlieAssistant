import { NavLink } from "react-router-dom";
import { Button, Tooltip } from "@kiyotakkkka/zvs-uikit-lib";
import { useAppNavigation } from "../../hooks";
import { NavigationTreeItem } from "../molecules";
import {
  ArrowExpandRightIcon,
  ArrowExpandLeftIcon,
  ZVSLogoIcon,
} from "../atoms";
import { AnimatedSlidedPanel } from "../organisms/AnimatedSlidedPanel";
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
  const compactRoutes = leafRoutes(routes);

  return (
    <AnimatedSlidedPanel
      dataTour="sidebar"
      storageKey="navigation-sidebar"
      side="left"
      defaultWidth={240}
      collapsedWidth={56}
      className="space-y-2 overflow-visible rounded-xl bg-main-800/40 p-2 shadow-sm"
      contentClassName="min-h-0 flex-1 overflow-visible"
      header={({ collapsed, contentVisible, toggle }) => (
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
              aria-expanded={!collapsed}
              className="inline-flex size-9 shrink-0 items-center justify-center border-0! p-0 text-main-400 shadow-none ring-0! hover:bg-main-600/50 hover:text-main-50"
              disabled={!contentVisible}
              onClick={toggle}
            >
              {collapsed ? (
                <ArrowExpandRightIcon className="size-5" />
              ) : (
                <ArrowExpandLeftIcon className="size-5" />
              )}
            </Button>
          </Tooltip>
        </div>
      )}
      collapsedContent={
        <nav aria-label="Основная навигация" className="space-y-1 overflow-visible">
          {compactRoutes.map((route) => {
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
          })}
        </nav>
      }
    >
      <nav aria-label="Основная навигация" className="space-y-0.5">
        {routes.map((route) => (
          <NavigationTreeItem
            key={route.id}
            node={route}
            currentPath={currentPath}
          />
        ))}
      </nav>
    </AnimatedSlidedPanel>
  );
};
