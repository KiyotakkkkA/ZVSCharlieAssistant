import { Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { AutomationTool } from "../../../../ipc/contracts";
import { ControlButton } from "../../atoms/basic";
import { EntityStatusBadge } from "@renderer/components/atoms";

interface Row extends AutomationTool {
  [key: string]: unknown;
}

export function AutomationToolsListTable({
  tools,
  onOpen,
}: {
  tools: AutomationTool[];
  onOpen: (tool: AutomationTool) => void;
}) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "name",
      title: "Инструмент",
      render: (x) => (
        <div>
          <p className="font-medium text-main-100">{x.name}</p>
          <p className="mt-1 font-mono text-xs text-main-500">{x.id}</p>
        </div>
      ),
    },
    {
      key: "category",
      title: "Категория",
      render: (x) => <span className="text-main-300">{x.category}</span>,
    },
    {
      key: "source",
      title: "Источник",
      render: () => (
        <span className="rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">
          Встроенный
        </span>
      ),
    },
    {
      key: "confirmation",
      title: "Подтверждение",
      render: (x) => (
        <span className="text-main-400">
          {x.requiresConfirmation ? "Требуется" : "Не требуется"}
        </span>
      ),
    },
    {
      key: "state",
      title: "Состояние",
      render: (x) => (
        <EntityStatusBadge
          status={x.enabled ? "active" : "disabled"}
          variant="base"
        />
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (x) => (
        <div className="flex justify-end">
          <ControlButton
            icon="eye"
            title="Подробнее"
            onClick={() => onOpen(x)}
          />
        </div>
      ),
    },
  ];
  return (
    <Table<Row>
      data={tools.map((x) => ({ ...x }))}
      columns={columns}
      rowKey="id"
      classNames={{
        root: "w-full",
        row: "transition-colors hover:bg-main-800/45",
      }}
    />
  );
}
