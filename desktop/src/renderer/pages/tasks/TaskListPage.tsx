import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  EmptyState,
  InputSmall,
  ScrollArea,
  Table,
  Tabs,
  type TableColumn,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { AgentTaskRun } from "../../../ipc/contracts";
import { APP_PATHS } from "../../app/routes";
import { EyeIcon, GraphIcon, TasksIcon } from "../../components/atoms";
import { PageHeader } from "../../components/organisms";
import { useHashRouter } from "../../hooks";
import { automationStore, tasksStore } from "../../stores";

interface AgentTaskRunRow extends AgentTaskRun {
  [key: string]: unknown;
}

const runKindLabels: Record<AgentTaskRun["kind"], string> = {
  chat: "Чат",
  planner: "Планировщик",
  agent: "Агент",
  scenario: "Сценарий",
};

const runOriginLabels: Record<AgentTaskRun["origin"], string> = {
  manual: "Ручной запуск",
  chat: "Из чата",
  background: "Фоновый запуск",
};

const statusMeta: Record<
  AgentTaskRun["status"],
  { label: string; className: string }
> = {
  queued: { label: "В очереди", className: "text-main-300 bg-main-700/60" },
  running: {
    label: "Выполняется",
    className: "text-accent-light bg-accent-medium/10",
  },
  waiting_for_approval: {
    label: "Ожидает подтверждения",
    className: "text-warning-light bg-warning-medium/10",
  },
  completed: {
    label: "Завершён",
    className: "text-success-light bg-success-medium/10",
  },
  failed: {
    label: "Ошибка",
    className: "text-danger-light bg-danger-medium/10",
  },
  cancelled: {
    label: "Отменён",
    className: "text-main-400 bg-main-700/40",
  },
};

export const TaskListPage = observer(function TaskListPage() {
  const { goTo } = useHashRouter();
  const [query, setQuery] = useState("");

  useEffect(() => {
    void tasksStore.bootstrap(true);
    const timer = window.setInterval(
      () => void tasksStore.bootstrap(true),
      5000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const runs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return tasksStore.agentRuns;
    return tasksStore.agentRuns.filter((run) =>
      `${run.title} ${run.agentName ?? ""} ${run.scenarioName ?? ""} ${run.runId}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, tasksStore.agentRuns]);

  const columns: Array<TableColumn<AgentTaskRunRow>> = [
    {
      key: "title",
      title: "Запуск",
      render: (run) => (
        <div className="min-w-0">
          <p className="max-w-md truncate font-medium text-main-100">
            {run.title}
          </p>
          <p className="mt-1 text-xs text-main-500">Запуск #{run.runId}</p>
        </div>
      ),
    },
    {
      key: "kind",
      title: "Тип запуска",
      render: (run) => (
        <div>
          <p className="text-main-200">{runOriginLabels[run.origin]}</p>
        </div>
      ),
    },
    {
      key: "status",
      title: "Статус",
      render: (run) => {
        const meta = statusMeta[run.status];
        return (
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs ${meta.className}`}
            title={run.error ?? undefined}
          >
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      title: "Начат",
      render: (run) => (
        <span className="whitespace-nowrap text-main-400">
          {formatDate(run.createdAt)}
        </span>
      ),
    },
    {
      key: "completedAt",
      title: "Завершён",
      render: (run) => (
        <span className="whitespace-nowrap text-main-400">
          {run.completedAt ? formatDate(run.completedAt) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (run) => {
        const scenario = run.scenarioId
          ? automationStore.getScenario(run.scenarioId)
          : undefined;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-sm hover:bg-main-700/50"
              onClick={() =>
                goTo(
                  APP_PATHS.automation.scenarios.execution.replace(
                    ":runId",
                    String(run.runId),
                  ),
                )
              }
            >
              <EyeIcon className="size-3.5" />
              Подробнее
            </Button>
            {scenario ? (
              <Button
                variant="ghost"
                className="h-8 gap-1.5 px-2 text-sm hover:bg-main-700/50"
                onClick={() =>
                  goTo(
                    APP_PATHS.automation.scenarios.edit.replace(
                      ":scenarioId",
                      scenario.id,
                    ),
                  )
                }
              >
                <GraphIcon className="size-3.5" />
                Сценарий
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Задачи"
        description="История запусков сценариев из чата, вручную и в фоне."
        breadcrumbs={[{ label: "Задачи" }]}
        footer={
          <Tabs
            value="scenarios-runs"
            onChange={() => undefined}
            options={[
              {
                value: "scenarios-runs",
                label: `Сценарии · ${tasksStore.agentRuns.length}`,
              },
            ]}
          />
        }
      >
        <InputSmall
          preset="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder="Найти запуск"
          className="w-64"
        />
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1 p-1">
        {runs.length ? (
          <div className="overflow-hidden">
            <Table<AgentTaskRunRow>
              data={runs.map((run) => ({ ...run }))}
              columns={columns}
              rowKey="id"
              classNames={{
                root: "w-full",
                row: "transition-colors hover:bg-main-800/45",
              }}
            />
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center">
            <EmptyState
              icon={<TasksIcon className="size-6" />}
              title={query ? "Запуски не найдены" : "Запусков пока нет"}
              description={
                tasksStore.error ??
                (query
                  ? "Измените поисковый запрос."
                  : "Здесь появится история запусков сценариев.")
              }
            />
          </div>
        )}
      </ScrollArea>
    </section>
  );
});

function formatDate(value: string): string {
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(date);
}
