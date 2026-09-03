import { Alert, Button, Loader } from "@kiyotakkkka/zvs-uikit-lib";
import type { ZvsIdConnection } from "../../../ipc/contracts";
import { ZVSLogoIcon } from "../atoms";

interface ZvsIdAuthScreenProps {
  connection: ZvsIdConnection | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  onConnect: () => Promise<unknown>;
}

export function ZvsIdAuthScreen({
  connection,
  loading,
  busy,
  error,
  onConnect,
}: ZvsIdAuthScreenProps) {
  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-main-900">
        <Loader />
      </div>
    );
  }

  const connecting = busy || connection?.status === "connecting";

  return (
    <main className="grid min-h-screen place-items-center bg-main-900 p-6">
      <section className="w-full max-w-md rounded-3xl border border-main-700/50 bg-main-800/70 p-8 text-center shadow-xl">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-medium/10 text-accent-light">
          <ZVSLogoIcon className="size-12" />
        </span>
        <h1 className="mt-6 text-xl font-semibold text-main-50">
          Войдите в ZVS Assistant
        </h1>
        <p className="mt-2 text-sm leading-6 text-main-400">
          Подключите ZVS ID, чтобы начать работать с приложением.
        </p>

        {error ? (
          <Alert
            variant="danger"
            rounded="rounded-xl"
            className="mt-5 text-left"
          >
            {error}
          </Alert>
        ) : null}
        {connection && !connection.clientConfigured ? (
          <Alert
            variant="warning"
            rounded="rounded-xl"
            className="mt-5 text-left"
          >
            Приложение не зарегистрировано в ZVS ID.
          </Alert>
        ) : null}

        <Button
          variant="primary"
          className="mt-6 w-full justify-center"
          loading={connecting}
          loadingText="Ожидаем вход в браузере…"
          disabled={connection?.clientConfigured === false}
          onClick={() => void onConnect().catch(() => undefined)}
        >
          Войти через ZVS ID
        </Button>
        <p className="mt-4 text-xs leading-5 text-main-500">
          Пройдите авторизацию в браузере. После успешного входа вы
          автоматически вернётесь в приложение.
        </p>
      </section>
    </main>
  );
}
