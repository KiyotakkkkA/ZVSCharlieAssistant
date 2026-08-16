import { Alert, Button, ToastProvider } from "@kiyotakkkka/zvs-uikit-lib";
import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  automationStore,
  secretStorageStore,
  textProviderStore,
  chatStore,
  vectorStoreStore,
  tasksStore,
  terminalPolicyStore,
  directoryPolicyStore,
  integrationStore,
} from "../stores";
import { TerminalApprovalModal } from "../components/organisms/modals/TerminalApprovalModal";

/**
 * Разделение на обязательные и отложенные снимки: раньше при запуске
 * одновременно загружались все девять хранилищ, включая полные снимки
 * автоматизации и векторных баз, — время до первого экрана росло линейно с
 * объёмом данных, хотя большая часть этих данных нужна не на стартовой странице.
 */
const CRITICAL_STORES = [
  ["Секреты", () => secretStorageStore.bootstrap()],
  ["Диалоги", () => chatStore.bootstrap()],
  ["Политики терминала", () => terminalPolicyStore.bootstrap()],
  ["Политики директорий", () => directoryPolicyStore.bootstrap()],
] as const;

const DEFERRED_STORES = [
  ["Автоматизация", () => automationStore.bootstrap()],
  ["Провайдеры моделей", () => textProviderStore.bootstrap()],
  ["Векторные хранилища", () => vectorStoreStore.bootstrap()],
  ["Задачи", () => tasksStore.bootstrap()],
  ["Интеграции", () => integrationStore.bootstrap()],
] as const;

export function App() {
  const [failed, setFailed] = useState<string[]>([]);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    const run = async (
      entries: ReadonlyArray<readonly [string, () => Promise<unknown>]>,
    ) => {
      const results = await Promise.allSettled(
        entries.map(([, bootstrap]) => bootstrap()),
      );
      return entries
        .filter((_, index) => results[index]?.status === "rejected")
        .map(([label]) => label);
    };

    const critical = await run(CRITICAL_STORES);
    const deferred = await run(DEFERRED_STORES);
    setFailed([...critical, ...deferred]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try {
      await load();
    } finally {
      setRetrying(false);
    }
  }, [load]);

  return (
    <ToastProvider>
      {/* Прежде ошибки загрузки глушились `.catch(() => undefined)`, и
          повреждённая база выглядела как пустое приложение без объяснений. */}
      {failed.length ? (
        <Alert
          variant="danger"
          title="Не удалось загрузить данные"
          className="m-3 mb-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Разделы недоступны: {failed.join(", ")}.</span>
            <Button
              variant="ghost"
              loading={retrying}
              onClick={() => void retry()}
            >
              Повторить
            </Button>
          </div>
        </Alert>
      ) : null}
      <Outlet />
      <TerminalApprovalModal />
    </ToastProvider>
  );
}
