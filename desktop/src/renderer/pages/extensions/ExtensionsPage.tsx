import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Badge,
  Button,
  Code,
  ScrollArea,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { PageHeader } from "@renderer/components/organisms";
import { PrimaryButton } from "@renderer/components/atoms/buttons";
import { CopyIcon, PuzzleIcon, ScriptIcon } from "@renderer/components/atoms";
import { extensionStore } from "@renderer/stores";

const QUICK_COMMANDS: Array<{ command: string; description: string }> = [
  { command: "zvs", description: "интерактивный режим с навигацией" },
  {
    command: 'zvs -p "почини падающие тесты"',
    description: "одна задача и выход",
  },
  {
    command: 'zvs -p "..." --permission-mode plan',
    description: "только чтение, без правок",
  },
  {
    command: 'zvs -p "..." --json',
    description: "машинный вывод для скриптов",
  },
  { command: "zvs projects", description: "список проектов" },
  { command: "zvs diff", description: "правки файлов текущего диалога" },
];

export const ExtensionsPage = observer(function ExtensionsPage() {
  const toasts = useToasts();
  const status = extensionStore.cli;

  useEffect(() => {
    void extensionStore.bootstrap();
  }, []);

  const enable = () => {
    void extensionStore
      .install()
      .then((next) => {
        if (next.error)
          toasts.warning({
            title: "CLI установлен, но PATH не обновлён",
            description: next.error,
          });
        else
          toasts.success({
            title: "CLI включён",
            description: "Откройте новый терминал, чтобы команда стала видна",
          });
      })
      .catch((error: unknown) =>
        toasts.danger({
          title: "Не удалось включить CLI",
          description: error instanceof Error ? error.message : String(error),
        }),
      );
  };

  const disable = () => {
    void extensionStore
      .uninstall()
      .then(() => toasts.success({ title: "CLI отключён" }))
      .catch((error: unknown) =>
        toasts.danger({
          title: "Не удалось отключить CLI",
          description: error instanceof Error ? error.message : String(error),
        }),
      );
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <PageHeader
        title="Расширения"
        description="Дополнительные функциональности ассистента"
        breadcrumbs={[{ label: "Расширения" }]}
      />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-1 pb-5">
          <section className="rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
                  <ScriptIcon className="size-6" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-main-100">
                      Командная строка
                    </h2>
                    {status ? (
                      <Badge
                        variant={
                          extensionStore.cliReady
                            ? "success"
                            : status.installed
                              ? "warning"
                              : "secondary"
                        }
                        size="sm"
                      >
                        {extensionStore.cliReady
                          ? "готов к работе"
                          : status.installed
                            ? "нужен новый терминал"
                            : "выключен"}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-main-500">
                    Запускает задачи и диалоги ассистента из любого терминала.
                    Работает поверх запущенного приложения: те же модели,
                    проекты, политики доступа и история.
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {status?.installed ? (
                  <Button
                    type="button"
                    variant="danger"
                    rounded="rounded-full"
                    loading={extensionStore.working}
                    loadingText="Отключаю..."
                    className="px-2"
                    onClick={disable}
                  >
                    Отключить
                  </Button>
                ) : (
                  <PrimaryButton
                    type="button"
                    variant="create"
                    label="Включить CLI"
                    loading={extensionStore.working}
                    disabled={!status || !status.entryExists}
                    onClick={enable}
                  />
                )}
              </div>
            </div>

            {status && status.entryExists ? (
              <div className="mt-4 text-sm text-main-400">
                Попробуйте <Code>zvs</Code> или <Code>zvs help</Code> в
                командной строке
              </div>
            ) : null}

            {status && !status.entryExists ? (
              <Alert
                variant="warning"
                title="Сборка CLI не найдена"
                className="mt-4"
              >
                Ожидается файл {status.entryPath}. Выполните «npm run build» в
                каталоге desktop и обновите страницу.
              </Alert>
            ) : null}
            {status?.error ? (
              <Alert
                variant="warning"
                title="PATH не удалось обновить автоматически"
                className="mt-4"
              >
                {status.error} Добавьте каталог {status.binDir} в переменную
                PATH вручную.
              </Alert>
            ) : null}
            {status?.installed && !status.onPath && !status.error ? (
              <Alert
                variant="info"
                title="Перезапустите терминал"
                className="mt-4"
              >
                PATH обновлён для пользователя, но уже открытые окна терминала
                читают его старую копию.
                {status.shellProfile
                  ? ` Настройка записана в ${status.shellProfile}.`
                  : ""}
              </Alert>
            ) : null}
            <Alert
              variant="warning"
              title="Для работы расширения - основное приложение должно быть запущено"
              className="mt-5"
            />
          </section>

          <section className="rounded-xl bg-main-800/10 p-5 text-xs text-main-500 ring-1 ring-main-700/25">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-main-700/35 text-main-400">
                <PuzzleIcon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium text-main-300">
                  Другие расширения
                </p>
                <p className="mt-0.5">
                  Здесь появятся MCP-серверы и внешние интеграции.
                </p>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
});

function PathRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-main-500">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-main-300">
          {value}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          rounded="rounded-lg"
          label={`Скопировать ${label.toLowerCase()}`}
          className="shrink-0 border-0! p-1 shadow-none ring-0! hover:bg-main-700/50"
          onClick={() => onCopy(value)}
        >
          <CopyIcon className="size-4" />
        </Button>
      </dd>
    </div>
  );
}
