import { Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { AutomationAgent } from "../../../../ipc/contracts";
import { ControlButton } from "../../atoms/buttons";
import { EntityStatusBadge } from "@renderer/components/atoms";

interface Row extends AutomationAgent {
  [key: string]: unknown;
}

interface Props {
  agents: AutomationAgent[];
  modelLabel: (id: string) => string;
  onEdit: (agent: AutomationAgent) => void;
  onDelete: (agent: AutomationAgent) => void;
}

const labels: Record<AutomationAgent["status"], string> = {
  active: "Активен",
  draft: "Черновик",
  disabled: "Отключён",
};

export function AutomationAgentsListTable({
  agents,
  modelLabel,
  onEdit,
  onDelete,
}: Props) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "name",
      title: "Агент",
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
      key: "model",
      title: "Модель",
      render: (x) => (
        <span className="text-main-300">
          {x.textModelId ? modelLabel(x.textModelId) : "Не настроена"}
        </span>
      ),
    },
    {
      key: "tools",
      title: "Инструменты",
      render: (x) => (
        <span className="text-main-400">{x.allowedToolIds.length}</span>
      ),
    },
    {
      key: "runs",
      title: "Запуски",
      render: (x) => <span className="text-main-400">{x.runs}</span>,
    },
    {
      key: "updatedAt",
      title: "Обновлён",
      render: (x) => (
        <span className="whitespace-nowrap text-main-400">{x.updatedAt}</span>
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
            icon="edit"
            title="Изменить"
            onClick={() => onEdit(x)}
          />
          <ControlButton
            icon="trash"
            title="Удалить"
            variant="delete"
            onClick={() => onDelete(x)}
          />
        </div>
      ),
    },
  ];
  return (
    <Table<Row>
      data={agents.map((x) => ({ ...x }))}
      columns={columns}
      rowKey="id"
      classNames={tableClassNames}
    />
  );
}

const tableClassNames = {
  root: "w-full",
  row: "transition-colors hover:bg-main-800/45",
};
