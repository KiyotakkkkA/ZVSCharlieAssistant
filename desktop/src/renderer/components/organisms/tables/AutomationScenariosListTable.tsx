import { Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { AutomationScenario } from "../../../../ipc/contracts";
import { ControlButton } from "../../atoms/buttons";
import { EntityStatusBadge } from "@renderer/components/atoms";

interface Row extends AutomationScenario {
  [key: string]: unknown;
}

export function AutomationScenariosListTable({
  scenarios,
  onEdit,
  onDelete,
}: {
  scenarios: AutomationScenario[];
  onEdit: (scenario: AutomationScenario) => void;
  onDelete: (scenario: AutomationScenario) => void;
}) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "name",
      title: "Сценарий",
      render: (x) => (
        <div>
          <p className="font-medium text-main-100">{x.name}</p>
          <p className="mt-1 max-w-xl truncate text-xs text-main-500">
            {x.description}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      title: "Статус",
      render: (x) => <EntityStatusBadge status={x.status} variant="base" />,
    },
    {
      key: "nodes",
      title: "Узлов",
      render: (x) => <span className="text-main-300">{x.nodesCount}</span>,
    },
    {
      key: "lastRun",
      title: "Последний запуск",
      render: (x) => (
        <span className="text-main-400">
          {x.lastRunAt ?? "Ещё не запускался"}
        </span>
      ),
    },
    {
      key: "updated",
      title: "Обновлён",
      render: (x) => <span className="text-main-400">{x.updatedAt}</span>,
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (x) => (
        <div className="flex justify-end gap-1">
          <ControlButton title="Открыть редактор" onClick={() => onEdit(x)} />
          <ControlButton
            title="Удалить сценарий"
            icon="trash"
            variant="delete"
            onClick={() => onDelete(x)}
          />
        </div>
      ),
    },
  ];
  return (
    <Table<Row>
      data={scenarios.map((x) => ({ ...x }))}
      columns={columns}
      rowKey="id"
      classNames={{
        root: "w-full",
        row: "transition-colors hover:bg-main-800/45",
      }}
    />
  );
}
