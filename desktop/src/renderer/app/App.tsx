import { ToastProvider } from "@kiyotakkkka/zvs-uikit-lib";
import { Header, NavigationSidebar } from "../components/layouts";

const AppContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex p-3 gap-3 h-screen">
      <NavigationSidebar />
      <div className="flex-1 flex flex-col gap-3">
        <Header />
        <main className="flex-1 rounded-lg p-2 bg-main-800/40">{children}</main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <ToastProvider>
      <AppContainer>MainContent</AppContainer>
    </ToastProvider>
  );
}
