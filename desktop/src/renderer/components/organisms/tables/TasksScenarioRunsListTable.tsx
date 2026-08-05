import { Button, Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { AgentTaskRun } from "../../../../ipc/contracts";
import { EyeIcon, GraphIcon } from "../../atoms";

interface Row extends AgentTaskRun {
  [key: string]: unknown;
}

const origins: Record<AgentTaskRun["origin"], string> = {
  manual: "Ручной запуск",
  chat: "Из чата",
  background: "Фоновый запуск",
};

const statuses: Record<
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
  cancelled: { label: "Отменён", className: "text-main-400 bg-main-700/40" },
};
export function TasksScenarioRunsListTable({
  runs,
  scenarioExists,
  onOpenDetails,
  onOpenScenario,
}: {
  runs: AgentTaskRun[];
  scenarioExists: (id: string) => boolean;
  onOpenDetails: (run: AgentTaskRun) => void;
  onOpenScenario: (run: AgentTaskRun) => void;
}) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "title",
      title: "Запуск",
      render: (x) => (
        <div className="min-w-0">
          <p className="max-w-md truncate font-medium text-main-100">
            {x.title}
          </p>
          <p className="mt-1 text-xs text-main-500">Запуск #{x.runId}</p>
        </div>
      ),
    },
    {
      key: "kind",
      title: "Тип запуска",
      render: (x) => <span className="text-main-200">{origins[x.origin]}</span>,
    },
    {
      key: "status",
      title: "Статус",
      render: (x) => {
        const meta = statuses[x.status];
        return (
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs ${meta.className}`}
            title={x.error ?? undefined}
          >
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "createdAt",
      title: "Начат",
      render: (x) => (
        <span className="whitespace-nowrap text-main-400">
          {formatDate(x.createdAt)}
        </span>
      ),
    },
    {
      key: "completedAt",
      title: "Завершён",
      render: (x) => (
        <span className="whitespace-nowrap text-main-400">
          {x.completedAt ? formatDate(x.completedAt) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (x) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            className="h-8 gap-1.5 px-2 text-sm hover:bg-main-700/50"
            onClick={() => onOpenDetails(x)}
          >
            <EyeIcon className="size-3.5" />
            Подробнее
          </Button>
          {x.scenarioId && scenarioExists(x.scenarioId) ? (
            <Button
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-sm hover:bg-main-700/50"
              onClick={() => onOpenScenario(x)}
            >
              <GraphIcon className="size-3.5" />
              Сценарий
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <Table<Row>
      data={runs.map((x) => ({ ...x }))}
      columns={columns}
      rowKey="id"
      classNames={{
        root: "w-full",
        row: "transition-colors hover:bg-main-800/45",
      }}
    />
  );
}
function formatDate(value: string) {
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
