import { ToastProvider } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect } from "react";
import { AppContainer } from "../components/layouts";
import { secretStorageStore } from "../stores";

export function App() {
  useEffect(() => {
    void secretStorageStore.bootstrap().catch(() => undefined);
  }, []);

  return (
    <ToastProvider>
      <AppContainer />
    </ToastProvider>
  );
}
