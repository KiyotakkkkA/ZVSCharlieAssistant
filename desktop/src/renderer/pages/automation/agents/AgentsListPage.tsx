import { observer } from "mobx-react-lite";
import { Button, EmptyState } from "@kiyotakkkka/zvs-uikit-lib";
import { useNavigate } from "react-router-dom";
import { APP_PATHS } from "../../../app/routes";
import {
  ClockIcon,
  PlusIcon,
  RobotIcon,
  SearchIcon,
} from "../../../components/atoms";
import { automationStore } from "../../../stores";
import { useMemo, useState } from "react";

export const AgentsListPage = observer(function AgentsListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const agents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? automationStore.agents.filter((agent) =>
          `${agent.name} ${agent.description}`
            .toLocaleLowerCase()
            .includes(normalized),
        )
      : automationStore.agents;
  }, [query, automationStore.agents]);

  return (
    <section className="flex min-h-full flex-col p-4">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-main-400">Автоматизация</p>
          <h1 className="text-2xl font-semibold tracking-tight">Агенты</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-main-400">
            Настраивайте инструкции, инструменты и разрешения исполнителей.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate(APP_PATHS.automation.agents.create)}
        >
          <PlusIcon className="size-4" />
          Создать агента
        </Button>
      </header>

      <div className="mb-4 flex justify-end border-b border-main-800 pb-4">
        <label className="flex h-9 w-64 items-center gap-2 rounded-lg bg-main-800/70 px-3 text-main-400 ring-1 ring-main-700/60 focus-within:ring-main-500">
          <SearchIcon className="size-4" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти агента"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-main-500"
          />
        </label>
      </div>

      {agents.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {agents.map((agent) => (
            <article
              key={agent.id}
              className="rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600"
            >
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-200">
                  <RobotIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-main-100">{agent.name}</h2>
                    <StatusBadge status={agent.status} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-main-400">
                    {agent.description}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-main-700/40 pt-4">
                <div className="flex items-center gap-4 text-xs text-main-500">
                  <span>{agent.allowedToolIds.length} инструментов</span>
                  <span>{agent.runs} запусков</span>
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    {agent.updatedAt}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    navigate(
                      APP_PATHS.automation.agents.edit.replace(
                        ":agentId",
                        agent.id,
                      ),
                    )
                  }
                >
                  Настроить
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-80 place-items-center">
          <EmptyState
            icon={<RobotIcon className="size-6" />}
            title="Агенты не найдены"
            description="Измените запрос или создайте нового агента."
          />
        </div>
      )}
    </section>
  );
});

function StatusBadge({
  status,
}: {
  status: "draft" | "active" | "disabled";
}) {
  const label =
    status === "active"
      ? "Активен"
      : status === "draft"
        ? "Черновик"
        : "Отключён";
  return (
    <span className="rounded-full bg-main-700/60 px-2 py-1 text-[10px] text-main-300">
      {label}
    </span>
  );
}
