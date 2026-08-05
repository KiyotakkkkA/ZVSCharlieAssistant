import { Table, type TableColumn } from "@kiyotakkkka/zvs-uikit-lib";
import type { SecretEntity } from "../../../../ipc/contracts";
import { KeyIcon } from "../../atoms";
import { ControlButton } from "../../atoms/buttons";

interface Row extends SecretEntity {
  [key: string]: unknown;
}

export function StorageSecretsListTable({
  secrets,
  categoryLabel,
  onCopy,
  onEdit,
  onDelete,
}: {
  secrets: SecretEntity[];
  categoryLabel: (id: number) => string;
  onCopy: (secret: SecretEntity) => void;
  onEdit: (secret: SecretEntity) => void;
  onDelete: (secret: SecretEntity) => void;
}) {
  const columns: Array<TableColumn<Row>> = [
    {
      key: "label",
      title: "Название",
      render: (x) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-main-800 text-main-300">
            <KeyIcon className="size-4" />
          </span>
          <span className="font-medium text-main-100">{x.label}</span>
        </div>
      ),
    },
    {
      key: "category",
      title: "Категория",
      render: (x) => (
        <span className="text-main-300">{categoryLabel(x.categoryId)}</span>
      ),
    },
    {
      key: "content",
      title: "Значение",
      render: () => (
        <span className="font-mono text-sm tracking-widest text-main-500">
          ••••••••••••
        </span>
      ),
    },
    {
      key: "type",
      title: "Тип",
      render: (x) => (
        <span className="inline-flex rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">
          {x.builtin ? "Системный" : "Пользовательский"}
        </span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (x) => (
        <div className="flex justify-end gap-1">
          <ControlButton
            icon="copy"
            title="Скопировать"
            onClick={() => onCopy(x)}
          />
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
        </div>
      ),
    },
  ];
  return (
    <Table<Row>
      data={secrets.map((x) => ({ ...x }))}
      columns={columns}
      rowKey="id"
      classNames={{
        root: "w-full",
        row: "transition-colors hover:bg-main-800/45",
      }}
    />
  );
}
