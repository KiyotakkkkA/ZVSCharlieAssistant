import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { NavigationSidebar } from "./NavigationSidebar";
import { ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";

export function AppContainer() {
  return (
    <div className="flex h-screen gap-3 p-3">
      <NavigationSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Header />
        <main className="min-h-0 flex-1 rounded-lg bg-main-800/40">
          <ScrollArea className="h-full">
            <Outlet />
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
