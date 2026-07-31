import { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  CodeView,
  EmptyState,
  Modal,
  Table,
  type TableColumn,
} from "@kiyotakkkka/zvs-uikit-lib";
import { EyeIcon, SettingsIcon } from "../../../components/atoms";
import { PageHeader } from "../../../components/organisms";
import type { AutomationTool } from "../../../domains/automation/models";
import { automationStore } from "../../../stores";

interface ToolRow extends AutomationTool {
  [key: string]: unknown;
}

export const ToolsListPage = observer(function ToolsListPage() {
  const [selectedTool, setSelectedTool] = useState<AutomationTool | null>(null);

  const columns: Array<TableColumn<ToolRow>> = [
    {
      key: "name",
      title: "Инструмент",
      render: (tool) => (
        <div>
          <p className="font-medium text-main-100">{tool.name}</p>
          <p className="mt-1 font-mono text-xs text-main-500">{tool.id}</p>
        </div>
      ),
    },
    {
      key: "category",
      title: "Категория",
      render: (tool) => <span className="text-main-300">{tool.category}</span>,
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
      render: (tool) => (
        <span className="text-main-400">
          {tool.requiresConfirmation ? "Требуется" : "Не требуется"}
        </span>
      ),
    },
    {
      key: "state",
      title: "Состояние",
      render: (tool) => (
        <span className={tool.enabled ? "text-success-light" : "text-main-500"}>
          {tool.enabled ? "Доступен" : "Отключён"}
        </span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (tool) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            label={`Посмотреть инструмент ${tool.name}`}
            title="Подробнее"
            className="size-9 p-0 text-main-400 hover:text-main-50"
            onClick={() => setSelectedTool(tool)}
          >
            <EyeIcon className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <section className="flex min-h-full flex-col p-4">
      <PageHeader
        title="Инструменты"
        description="Встроенные возможности приложения, которые можно разрешать агентам."
        breadcrumbs={[{ label: "Автоматизация" }, { label: "Инструменты" }]}
      />

      {automationStore.tools.length ? (
        <div className="overflow-hidden p-1">
          <Table<ToolRow>
            data={automationStore.tools.map((tool) => ({ ...tool }))}
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
            icon={<SettingsIcon className="size-6" />}
            title="Инструменты не найдены"
            description="В приложении пока не зарегистрировано встроенных инструментов."
          />
        </div>
      )}

      <Modal
        open={selectedTool !== null}
        onClose={() => setSelectedTool(null)}
        className="max-w-3xl"
      >
        <Modal.Header>
          <div>
            <h2 className="text-lg font-semibold">{selectedTool?.name}</h2>
            <p className="mt-1 font-mono text-xs text-main-500">
              {selectedTool?.id}
            </p>
          </div>
        </Modal.Header>
        <Modal.Content>
          {selectedTool ? (
            <div className="space-y-5">
              <p className="text-sm leading-6 text-main-300">
                {selectedTool.description}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <MetaItem label="Категория" value={selectedTool.category} />
                <MetaItem label="Источник" value="Встроенный" />
                <MetaItem
                  label="Подтверждение"
                  value={
                    selectedTool.requiresConfirmation
                      ? "Требуется"
                      : "Не требуется"
                  }
                />
              </div>
              <SchemaPreview
                title="Входные данные"
                schema={selectedTool.inputSchema}
              />
              <SchemaPreview
                title="Выходные данные"
                schema={selectedTool.outputSchema}
              />
            </div>
          ) : null}
        </Modal.Content>
        <Modal.Footer>
          <Button
            variant="secondary"
            className="px-2"
            onClick={() => setSelectedTool(null)}
          >
            Закрыть
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
});

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-main-800/45 p-3">
      <p className="text-xs text-main-500">{label}</p>
      <p className="mt-1 text-sm text-main-200">{value}</p>
    </div>
  );
}

function SchemaPreview({
  title,
  schema,
}: {
  title: string;
  schema: Record<string, unknown>;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-main-200">{title}</h3>
      <CodeView
        code={JSON.stringify(schema, null, 2)}
        language="json"
        fileName={
          title === "Входные данные"
            ? "input.schema.json"
            : "output.schema.json"
        }
        copyable
        defaultActions
        maxContentHeight={224}
      />
    </section>
  );
}
