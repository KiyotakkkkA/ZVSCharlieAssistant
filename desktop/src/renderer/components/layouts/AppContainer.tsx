import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { NavigationSidebar } from "./NavigationSidebar";
import { ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../app/routes";

export function AppContainer() {
  const { pathname } = useLocation();
  const ownsContentScroll =
    pathname === APP_PATHS.chat ||
    pathname === APP_PATHS.automation.agents.index ||
    pathname === APP_PATHS.automation.tools ||
    pathname === APP_PATHS.automation.scenarios.index ||
    pathname.startsWith(`${APP_PATHS.automation.scenarios.index}/`) ||
    pathname === APP_PATHS.storage.secrets ||
    pathname === APP_PATHS.storage.vectorDb;

  return (
    <div className="flex h-screen gap-3 p-3">
      <NavigationSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Header />
        <main className="min-h-0 flex-1 overflow-hidden rounded-lg bg-main-800/40">
          {ownsContentScroll ? (
            <div className="h-full min-h-0 overflow-hidden">
              <Outlet />
            </div>
          ) : (
            <ScrollArea className="h-full">
              <Outlet />
            </ScrollArea>
          )}
        </main>
      </div>
    </div>
  );
}
