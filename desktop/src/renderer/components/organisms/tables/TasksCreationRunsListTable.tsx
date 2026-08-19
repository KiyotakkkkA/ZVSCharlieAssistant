import { Button, Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { EntityGenerationRun } from "../../../../ipc/contracts";
import { EyeIcon, QuestionIcon } from "../../atoms";

interface Row extends EntityGenerationRun {
  [key: string]: unknown;
}

const kinds: Record<EntityGenerationRun["kind"], string> = {
  agent: "Агент",
  skill: "Навык",
};

const statuses: Record<
  EntityGenerationRun["status"],
  { label: string; className: string }
> = {
  queued: { label: "В очереди", className: "text-main-300 bg-main-700/60" },
  running: {
    label: "Генерируется",
    className: "text-accent-light bg-accent-medium/10",
  },
  waiting_for_approval: {
    label: "Ожидает подтверждения",
    className: "text-warning-light bg-warning-medium/10",
  },
  completed: {
    label: "Готово",
    className: "text-success-light bg-success-medium/10",
  },
  failed: {
    label: "Ошибка",
    className: "text-danger-light bg-danger-medium/10",
  },
  cancelled: { label: "Отменена", className: "text-main-400 bg-main-700/40" },
};

export function TasksCreationRunsListTable({
  runs,
  modelLabel,
  onOpenEntity,
  onShowError,
}: {
  runs: EntityGenerationRun[];
  modelLabel: (id: number) => string;
  onOpenEntity: (run: EntityGenerationRun) => void;
  onShowError: (run: EntityGenerationRun) => void;
}) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "prompt",
      title: "Запрос",
      render: (x) => (
        <div className="min-w-0">
          <p className="max-w-md truncate font-medium text-main-100">
            {x.entityName ?? x.prompt}
          </p>
          <p className="mt-1 text-xs text-main-500">
            {kinds[x.kind]} · генерация #{x.id}
          </p>
        </div>
      ),
    },
    {
      key: "modelId",
      title: "Модель",
      render: (x) => (
        <span className="text-main-200">{modelLabel(x.modelId)}</span>
      ),
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
      title: "Начата",
      render: (x) => (
        <span className="whitespace-nowrap text-main-400">
          {formatDate(x.createdAt)}
        </span>
      ),
    },
    {
      key: "completedAt",
      title: "Завершена",
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
          {x.entityId ? (
            <Button
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-sm hover:bg-main-700/50"
              onClick={() => onOpenEntity(x)}
            >
              <EyeIcon className="size-3.5" />
              Подробнее
            </Button>
          ) : null}
          {x.status === "failed" ? (
            <Button
              variant="ghost"
              className="h-8 gap-1.5 px-2 text-sm text-danger-light hover:bg-danger-medium/10"
              onClick={() => onShowError(x)}
            >
              <QuestionIcon className="size-3.5" />
              Подробнее
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
