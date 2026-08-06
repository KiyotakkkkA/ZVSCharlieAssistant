import { Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { AutomationSkill } from "../../../../ipc/contracts";
import { ControlButton } from "../../atoms/buttons";
import { EntityStatusBadge } from "@renderer/components/atoms";

interface Row extends AutomationSkill {
  [key: string]: unknown;
}

export function AutomationSkillsListTable({
  skills,
  onEdit,
  onDelete,
}: {
  skills: AutomationSkill[];
  onEdit: (skill: AutomationSkill) => void;
  onDelete: (skill: AutomationSkill) => void;
}) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "name",
      title: "Навык",
      render: (x) => (
        <div>
          <p className="font-medium">{x.name}</p>
          <p className="font-mono text-xs text-main-500">{x.slug}</p>
        </div>
      ),
    },
    {
      key: "status",
      title: "Статус",
      render: (x) => <EntityStatusBadge status={x.status} variant="base" />,
    },
    {
      key: "type",
      title: "Тип",
      render: (x) => (
        <span className="inline-flex rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">
          {x.builtin ? "Системная" : "Пользовательская"}
        </span>
      ),
    },
    { key: "agents", title: "Агенты", render: (x) => x.assignedAgentsCount },
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
          {!x.builtin ? (
            <ControlButton
              icon="trash"
              title="Удалить"
              variant="delete"
              onClick={() => onDelete(x)}
            />
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <Table<Row>
      data={skills.map((x) => ({ ...x }))}
      columns={columns}
      rowKey="id"
      classNames={{
        root: "w-full",
        row: "transition-colors hover:bg-main-800/45",
      }}
    />
  );
}
