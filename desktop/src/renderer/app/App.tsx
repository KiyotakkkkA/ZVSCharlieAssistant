import { ToastProvider } from "@kiyotakkkka/zvs-uikit-lib";
import { AppContainer } from "../components/layouts";

export function App() {
  return (
    <ToastProvider>
      <AppContainer />
    </ToastProvider>
  );
}
