import { useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  CodeView,
  EmptyState,
  InputSmall,
  Modal,
  ScrollArea,
  Switcher,
  Table,
  useToasts,
  type TableColumn,
} from "@kiyotakkkka/zvs-uikit-lib";
import { SecretOrientedSelect, SettingsIcon } from "../../../components/atoms";
import { PageHeader } from "../../../components/organisms";
import { AutomationToolCard } from "../../../components/molecules";
import type { AutomationTool } from "../../../../ipc/contracts";
import { automationStore } from "../../../stores";
import { ControlButton } from "@renderer/components/atoms/buttons";

interface ToolRow extends AutomationTool {
  [key: string]: unknown;
}

export const ToolsListPage = observer(function ToolsListPage() {
  const toasts = useToasts();
  const [selectedTool, setSelectedTool] = useState<AutomationTool | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const tools = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? automationStore.tools.filter((tool) =>
          `${tool.name} ${tool.id}`.toLocaleLowerCase().includes(normalized),
        )
      : automationStore.tools;
  }, [query, automationStore.tools]);

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
          <ControlButton
            icon="eye"
            title="Подробнее"
            onClick={() => setSelectedTool(tool)}
          />
        </div>
      ),
    },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Инструменты"
        description="Встроенные возможности приложения, которые можно разрешать агентам."
        breadcrumbs={[{ label: "Автоматизация" }, { label: "Инструменты" }]}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Switcher
            value={viewMode}
            onChange={(value) => setViewMode(value as "table" | "cards")}
            options={[
              { value: "table", label: "Таблица" },
              { value: "cards", label: "Карточки" },
            ]}
          />
          <InputSmall
            preset="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            placeholder="Найти инструмент"
            className="w-64"
          />
        </div>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1 p-1">
        {tools.length && viewMode === "cards" ? (
          <div className="grid gap-3 xl:grid-cols-3">
            {tools.map((tool) => (
              <AutomationToolCard
                key={tool.id}
                tool={tool}
                onOpen={setSelectedTool}
              />
            ))}
          </div>
        ) : tools.length ? (
          <div className="overflow-hidden">
            <Table<ToolRow>
              data={tools.map((tool) => ({ ...tool }))}
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
              description={
                query
                  ? "Измените поисковый запрос."
                  : "В приложении пока не зарегистрировано встроенных инструментов."
              }
            />
          </div>
        )}
      </ScrollArea>

      <Modal
        rounded="rounded-4xl"
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
              {selectedTool.secretRequirements.length ? (
                <section className="space-y-3 border-t border-main-700/40 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold text-main-200">
                      Настройка секретов
                    </h3>
                  </div>
                  {selectedTool.secretRequirements.map((requirement) => {
                    const binding = selectedTool.secretBindings.find(
                      (item) => item.key === requirement.key,
                    );
                    return (
                      <div key={requirement.key}>
                        <label className="mb-2 block text-xs font-medium text-main-400">
                          {requirement.label}
                          {requirement.required ? " · обязательно" : ""}
                        </label>
                        <SecretOrientedSelect
                          categoryId={requirement.categoryId}
                          value={binding ? String(binding.secretId) : ""}
                          onChange={(value) => {
                            void automationStore
                              .upsertToolSecretBinding({
                                toolId: selectedTool.id,
                                key: requirement.key,
                                secretId: value ? Number(value) : null,
                              })
                              .then((tool) => {
                                setSelectedTool(tool);
                                toasts.success({
                                  title: "Секрет инструмента сохранён",
                                });
                              })
                              .catch((error: unknown) =>
                                toasts.danger({
                                  title: "Не удалось сохранить секрет",
                                  description:
                                    error instanceof Error
                                      ? error.message
                                      : String(error),
                                }),
                              );
                          }}
                          placeholder="Выберите Ollama API key"
                          searchable
                          searchPlaceholder="Найти ключ"
                          triggerClassName="w-full"
                          className="w-full"
                          menuWidth="auto"
                        />
                      </div>
                    );
                  })}
                </section>
              ) : null}
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
        defaultActions
        maxContentHeight={224}
      />
    </section>
  );
}
