import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Alert, Button, EmptyState } from "@kiyotakkkka/zvs-uikit-lib";
import {
  ChevronDownIcon,
  CogIcon,
  TransitConnectionIcon,
  WebIcon,
} from "../atoms";
import type { McpServerState, McpServerStatus } from "../../../ipc/contracts";

const STATUS_META: Record<
  McpServerStatus,
  { label: string; tone: string; dot: string }
> = {
  connecting: {
    label: "Подключается",
    tone: "text-accent-light",
    dot: "bg-accent-light animate-pulse",
  },
  connected: {
    label: "Подключён",
    tone: "text-success-light",
    dot: "bg-success-light",
  },
  error: { label: "Ошибка", tone: "text-danger-light", dot: "bg-danger-light" },
  disabled: { label: "Отключён", tone: "text-main-500", dot: "bg-main-600" },
};

export const McpServersView = observer(function McpServersView({
  servers,
  configPath,
  configError,
}: {
  servers: McpServerState[];
  configPath: string;
  configError: string | null;
}) {
  if (configError)
    return (
      <div className="space-y-4">
        <Alert variant="danger" title="Не удалось прочитать конфигурацию MCP">
          {configError}
        </Alert>
        <p className="font-mono text-xs text-main-500">{configPath}</p>
      </div>
    );

  if (!servers.length)
    return (
      <div className="grid min-h-80 place-items-center">
        <EmptyState
          icon={<TransitConnectionIcon className="size-6" />}
          title="MCP-серверы не настроены"
          description={`Добавьте серверы в файл конфигурации и нажмите «Обновить».\n${configPath}`}
        />
      </div>
    );

  return (
    <div className="grid items-start gap-3 xl:grid-cols-2">
      {servers.map((server) => (
        <McpServerCard key={server.id} server={server} />
      ))}
    </div>
  );
});

function McpServerCard({ server }: { server: McpServerState }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[server.status];
  const canExpand = server.tools.length > 0 || Boolean(server.error);

  return (
    <div className="rounded-2xl bg-main-800/45 p-4 ring-1 ring-main-700/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-main-800/60 text-main-400">
            <WebIcon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-main-100">{server.id}</p>
            <p className="text-[11px] uppercase tracking-wide text-main-600">
              {server.transport}
            </p>
          </div>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 text-xs ${meta.tone}`}
        >
          <span className={`size-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-main-500">
        <span>
          {server.status === "connected"
            ? `Инструментов: ${server.tools.length}`
            : server.status === "connecting"
              ? "Ожидание ответа сервера…"
              : server.status === "disabled"
                ? "Отключён в конфигурации"
                : "Не удалось подключиться"}
        </span>
        {canExpand ? (
          <Button
            variant="ghost"
            rounded="rounded-lg"
            onClick={() => setExpanded((current) => !current)}
            className="hover:bg-main-700/40 px-2"
          >
            {expanded ? "Свернуть" : "Подробнее"}
            <ChevronDownIcon
              className={`size-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 border-t border-main-700/40 pt-3">
          {server.error ? (
            <p className="text-xs leading-5 text-danger-light">
              {server.error}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {server.tools.map((tool) => (
                <li key={tool.name} className="flex items-start gap-2 text-xs">
                  <CogIcon className="mt-0.5 size-3.5 shrink-0 text-main-600" />
                  <div className="min-w-0">
                    <span className="font-mono text-main-200">{tool.name}</span>
                    {tool.description ? (
                      <p className="mt-0.5 text-main-500">{tool.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
