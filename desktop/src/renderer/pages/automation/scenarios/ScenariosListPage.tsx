import { observer } from "mobx-react-lite";
import {
  Button,
  EmptyState,
  Table,
  useToasts,
  type TableColumn,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { TasksIcon } from "../../../components/atoms";
import { DangerModal, PageHeader } from "../../../components/organisms";
import type { AutomationScenario } from "../../../../ipc/contracts";
import { useHashRouter } from "../../../hooks";
import { automationStore } from "../../../stores";
import {
  ControlButton,
  CreateButton,
} from "@renderer/components/atoms/buttons";
import { useState } from "react";

interface ScenarioRow extends AutomationScenario {
  [key: string]: unknown;
}

export const ScenariosListPage = observer(function ScenariosListPage() {
  const { goTo } = useHashRouter();
  const toasts = useToasts();
  const [scenarioToDelete, setScenarioToDelete] =
    useState<AutomationScenario | null>(null);
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
            onClick={() =>
              goTo(
                APP_PATHS.automation.scenarios.edit.replace(
                  ":scenarioId",
                  scenario.id,
                ),
              )
            }
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
    <section className="flex min-h-full flex-col p-4">
      <PageHeader
        title="Сценарии"
        description="Объединяйте агентов в управляемые последовательности выполнения."
        breadcrumbs={[{ label: "Автоматизация" }, { label: "Сценарии" }]}
      >
        <CreateButton
          label="Добавить сценарий"
          onClick={() => goTo(APP_PATHS.automation.scenarios.create)}
        />
      </PageHeader>

      {automationStore.scenarios.length ? (
        <div className="overflow-hidden p-1">
          <Table<ScenarioRow>
            data={automationStore.scenarios.map((scenario) => ({
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
            title="Сценариев пока нет"
            description="Создайте первый сценарий автоматизации."
            action={
              <CreateButton
                label="Добавить сценарий"
                onClick={() => goTo(APP_PATHS.automation.scenarios.create)}
              />
            }
          />
        </div>
      )}

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
