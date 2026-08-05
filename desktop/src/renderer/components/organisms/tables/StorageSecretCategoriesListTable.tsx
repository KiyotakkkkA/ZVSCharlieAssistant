import { Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { SecretCategory } from "../../../../ipc/contracts";
import { FolderIcon } from "../../atoms";
import { ControlButton } from "../../atoms/buttons";

interface Row extends SecretCategory {
  [key: string]: unknown;
}

export function StorageSecretCategoriesListTable({
  categories,
  secretsCount,
  onEdit,
  onDelete,
}: {
  categories: SecretCategory[];
  secretsCount: (id: number) => number;
  onEdit: (category: SecretCategory) => void;
  onDelete: (category: SecretCategory) => void;
}) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "label",
      title: "Название",
      render: (x) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-main-800 text-main-300">
            <FolderIcon className="size-4" />
          </span>
          <span className="font-medium text-main-100">{x.label}</span>
        </div>
      ),
    },
    {
      key: "count",
      title: "Секретов",
      render: (x) => (
        <span className="text-main-300">{secretsCount(x.id)}</span>
      ),
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
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (x) => (
        <div className="flex justify-end">
          {!x.builtin ? (
            <>
              <ControlButton
                icon="edit"
                title="Изменить"
                onClick={() => onEdit(x)}
              />
              <ControlButton
                icon="trash"
                variant="delete"
                title="Удалить"
                onClick={() => onDelete(x)}
              />
            </>
          ) : null}
        </div>
      ),
    },
  ];
  return (
    <Table<Row>
      data={categories.map((x) => ({ ...x }))}
      columns={columns}
      rowKey="id"
      classNames={{
        root: "w-full",
        row: "transition-colors hover:bg-main-800/45",
      }}
    />
  );
}
