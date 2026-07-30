import { Separator } from "@kiyotakkkka/zvs-uikit-lib";
import { NavLink } from "react-router-dom";
import { useHashRouter } from "../../hooks";

export const NavigationSidebar = () => {
  const { routes } = useHashRouter();

  return (
    <aside className="w-full max-w-60 space-y-2 rounded-lg bg-main-800/40 p-2">
      <div>NavigationHeader</div>
      <Separator className="my-2" />
      <nav aria-label="Основная навигация" className="space-y-2">
        {routes.map(({ id, label, path, icon: RouteIcon }) => (
          <NavLink
            key={id}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              [
                "flex items-center gap-3 rounded-lg p-2 text-main-200 transition-colors",
                "hover:bg-main-800/60 hover:text-main-50",
                isActive ? "bg-main-700/60 text-main-50" : "",
              ].join(" ")
            }
          >
            <RouteIcon className="size-5 shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
