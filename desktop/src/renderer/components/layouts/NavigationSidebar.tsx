import { Separator } from "@kiyotakkkka/zvs-uikit-lib";
import { useHashRouter } from "../../hooks";
import { NavigationTreeItem } from "../molecules";

export const NavigationSidebar = () => {
  const { currentPath, routes } = useHashRouter();

  return (
    <aside className="w-full max-w-60 rounded-xl bg-main-800/40 p-2 shadow-sm">
      <div className="px-1 py-1 font-medium text-main-100">
        NavigationHeader
      </div>
      <Separator className="my-2 opacity-70" />
      <nav aria-label="Основная навигация" className="space-y-0.5">
        {routes.map((route) => (
          <NavigationTreeItem
            key={route.id}
            node={route}
            currentPath={currentPath}
          />
        ))}
      </nav>
    </aside>
  );
};
