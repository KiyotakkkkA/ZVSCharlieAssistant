import { observer } from "mobx-react-lite";
import {
  EmptyState,
  InputSmall,
  ScrollArea,
  Switcher,
  Table,
  useToasts,
  type TableColumn,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { TasksIcon } from "../../../components/atoms";
import { AutomationScenarioCard } from "../../../components/molecules";
import { DangerModal, PageHeader } from "../../../components/organisms";
import type { AutomationScenario } from "../../../../ipc/contracts";
import { useHashRouter } from "../../../hooks";
import { automationStore } from "../../../stores";
import {
  ControlButton,
  CreateButton,
} from "@renderer/components/atoms/buttons";
import { useMemo, useState } from "react";

interface ScenarioRow extends AutomationScenario {
  [key: string]: unknown;
}

export const ScenariosListPage = observer(function ScenariosListPage() {
  const { goTo } = useHashRouter();
  const toasts = useToasts();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("cards");
  const [scenarioToDelete, setScenarioToDelete] =
    useState<AutomationScenario | null>(null);
  const scenarios = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized
      ? automationStore.scenarios.filter((scenario) =>
          scenario.name.toLocaleLowerCase().includes(normalized),
        )
      : automationStore.scenarios;
  }, [query, automationStore.scenarios]);

  const editScenario = (scenario: AutomationScenario) =>
    goTo(
      APP_PATHS.automation.scenarios.edit.replace(":scenarioId", scenario.id),
    );
  const columns: Array<TableColumn<ScenarioRow>> = [
    {
      key: "name",
      title: "Сценарий",
      render: (scenario) => (
        <div>
          <p className="font-medium text-main-100">{scenario.name}</p>
          <p className="mt-1 max-w-xl truncate text-xs text-main-500">
            {scenario.description}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      title: "Статус",
      render: (scenario) => (
        <span className="rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">
          {scenario.status === "active"
            ? "Активен"
            : scenario.status === "draft"
              ? "Черновик"
              : "Отключён"}
        </span>
      ),
    },
    {
      key: "nodes",
      title: "Узлов",
      render: (scenario) => (
        <span className="text-main-300">{scenario.nodesCount}</span>
      ),
    },
    {
      key: "lastRun",
      title: "Последний запуск",
      render: (scenario) => (
        <span className="text-main-400">
          {scenario.lastRunAt ?? "Ещё не запускался"}
        </span>
      ),
    },
    {
      key: "updated",
      title: "Обновлён",
      render: (scenario) => (
        <span className="text-main-400">{scenario.updatedAt}</span>
      ),
    },
    {
      key: "actions",
      title: <span className="sr-only">Действия</span>,
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (scenario) => (
        <div className="flex justify-end gap-1">
          <ControlButton
            title="Открыть редактор"
            onClick={() => editScenario(scenario)}
          />
          <ControlButton
            title="Удалить сценарий"
            icon="trash"
            variant="delete"
            onClick={() => setScenarioToDelete(scenario)}
          />
        </div>
      ),
    },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Сценарии"
        description="Объединяйте агентов в управляемые последовательности выполнения."
        breadcrumbs={[{ label: "Автоматизация" }, { label: "Сценарии" }]}
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
            placeholder="Найти сценарий"
            className="w-64"
          />
          <CreateButton
            label="Добавить сценарий"
            onClick={() => goTo(APP_PATHS.automation.scenarios.create)}
          />
        </div>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1 p-1">
      {scenarios.length && viewMode === "cards" ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {scenarios.map((scenario) => (
            <AutomationScenarioCard
              key={scenario.id}
              scenario={scenario}
              onEdit={editScenario}
              onDelete={setScenarioToDelete}
            />
          ))}
        </div>
      ) : scenarios.length ? (
        <div className="overflow-hidden">
          <Table<ScenarioRow>
            data={scenarios.map((scenario) => ({
              ...scenario,
            }))}
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
            icon={<TasksIcon className="size-6" />}
            title={query ? "Сценарии не найдены" : "Сценариев пока нет"}
            description={query ? "Измените поисковый запрос." : "Создайте первый сценарий автоматизации."}
            action={
              query ? undefined : <CreateButton
                label="Добавить сценарий"
                onClick={() => goTo(APP_PATHS.automation.scenarios.create)}
              />
            }
          />
        </div>
      )}
      </ScrollArea>

      {scenarioToDelete ? (
        <DangerModal
          model={scenarioToDelete}
          title="Удалить сценарий"
          description={(scenario) => (
            <p>
              Сценарий{" "}
              <span className="font-medium text-main-50">{scenario.name}</span>{" "}
              и сохранённая схема графа будут удалены без возможности
              восстановления.
            </p>
          )}
          onCancel={() => setScenarioToDelete(null)}
          onConfirm={async (scenario) => {
            await automationStore.deleteScenario(scenario.id);
            setScenarioToDelete(null);
            toasts.success({ title: "Сценарий удалён" });
          }}
        />
      ) : null}
    </section>
  );
});
