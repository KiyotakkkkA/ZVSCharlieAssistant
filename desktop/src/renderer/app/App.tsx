import { ToastProvider } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import {
  automationStore,
  secretStorageStore,
  textProviderStore,
  chatStore,
  vectorStoreStore,
  tasksStore,
  terminalPolicyStore,
} from "../stores";
import { TerminalApprovalModal } from "../components/organisms/modals/TerminalApprovalModal";

export function App() {
  useEffect(() => {
    void secretStorageStore.bootstrap().catch(() => undefined);
    void automationStore.bootstrap().catch(() => undefined);
    void textProviderStore.bootstrap().catch(() => undefined);
    void chatStore.bootstrap().catch(() => undefined);
    void vectorStoreStore.bootstrap().catch(() => undefined);
    void tasksStore.bootstrap().catch(() => undefined);
    void terminalPolicyStore.bootstrap().catch(() => undefined);
  }, []);

  return (
    <ToastProvider>
      <Outlet />
      <TerminalApprovalModal />
    </ToastProvider>
  );
}
