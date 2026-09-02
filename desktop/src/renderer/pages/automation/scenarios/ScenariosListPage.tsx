import { observer } from "mobx-react-lite";
import {
  EmptyState,
  InputSmall,
  ScrollArea,
  Switcher,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../../app/routes";
import { TasksIcon } from "../../../components/atoms";
import { AutomationScenarioCard } from "../../../components/molecules";
import { PageHeader } from "../../../components/organisms";
import type { AutomationScenario } from "../../../../ipc/contracts";
import { useAppNavigation } from "../../../hooks";
import { automationStore } from "../../../stores";
import { PrimaryButton } from "@renderer/components/atoms/basic";
import { useMemo, useState } from "react";
import { DangerModal } from "@renderer/components/organisms/modals";
import { AutomationScenariosListTable } from "@renderer/components/organisms/tables";

export const ScenariosListPage = observer(function ScenariosListPage() {
  const { goTo } = useAppNavigation();
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
  return (
    <section
      data-tour="scenarios-page"
      className="flex h-full min-h-0 flex-col overflow-hidden p-4"
    >
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
          <PrimaryButton
            label="Добавить сценарий"
            onClick={() => goTo(APP_PATHS.automation.scenarios.create)}
          />
        </div>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1 p-1">
        {scenarios.length && viewMode === "cards" ? (
          <div className="grid auto-rows-fr gap-3 xl:grid-cols-3">
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
            <AutomationScenariosListTable
              scenarios={scenarios}
              onEdit={editScenario}
              onDelete={setScenarioToDelete}
            />
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center">
            <EmptyState
              icon={<TasksIcon className="size-6" />}
              title={query ? "Сценарии не найдены" : "Сценариев пока нет"}
              description={
                query
                  ? "Измените поисковый запрос."
                  : "Сценарий — граф из триггера, условий и действий для повторяющегося процесса."
              }
              action={
                query ? undefined : (
                  <PrimaryButton
                    label="Создать сценарий"
                    onClick={() => goTo(APP_PATHS.automation.scenarios.create)}
                  />
                )
              }
            />
          </div>
        )}
      </ScrollArea>

      <DangerModal
        open={scenarioToDelete !== null}
        model={scenarioToDelete}
        title="Удалить сценарий"
        description={(scenario) => (
          <p>
            Сценарий «
            <strong className="font-semibold text-main-50">
              {scenario.name}
            </strong>
            » и сохранённая схема графа будут удалены без возможности
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
    </section>
  );
});
