import { useAppNavigation } from "../../hooks";
import { AppBreadcrumbs, type AppBreadcrumbItem } from "../molecules";
import { NAVIGATION_ROUTES, type NavigationRoute } from "../../app/routes";

/**
 * Раньше шапка выводила буквально слово «Header» на каждом экране. Собственных
 * данных у неё нет, поэтому она показывает положение в навигации, используя уже
 * написанный, но нигде не подключённый `AppBreadcrumbs`.
 */
function findTrail(
  routes: readonly NavigationRoute[],
  path: string,
  parents: NavigationRoute[] = [],
): NavigationRoute[] | null {
  for (const route of routes) {
    const trail = [...parents, route];
    if (route.path && (route.path === path || path.startsWith(`${route.path}/`)))
      return trail;
    const nested = route.children && findTrail(route.children, path, trail);
    if (nested) return nested;
  }
  return null;
}

export const Header = () => {
  const { currentPath } = useAppNavigation();
  const trail = findTrail(NAVIGATION_ROUTES, currentPath) ?? [];
  const active = trail.at(-1);
  const Icon = active?.icon;

  const items: AppBreadcrumbItem[] = trail.map((route) => ({
    label: route.label,
    to: route.path,
  }));

  return (
    <header className="flex h-11 items-center gap-3 rounded-lg bg-main-800/40 px-3">
      {Icon ? (
        <span className="grid size-6 shrink-0 place-items-center text-main-400">
          <Icon className="size-4" />
        </span>
      ) : null}
      <h1 className="truncate text-sm font-medium text-main-200">
        {active?.label ?? "ZVS Assistant"}
      </h1>
      {items.length > 1 ? (
        <AppBreadcrumbs items={items} />
      ) : (
        <span className="ml-auto" />
      )}
    </header>
  );
};
