import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  EmptyState,
  InputSmall,
  ScrollArea,
  Tabs,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../app/routes";
import { TasksIcon } from "../../components/atoms";
import { PageHeader } from "../../components/organisms";
import { useAppNavigation } from "../../hooks";
import { automationStore, tasksStore } from "../../stores";
import { TasksScenarioRunsListTable } from "@renderer/components/organisms/tables";

export const TaskListPage = observer(function TaskListPage() {
  const { goTo } = useAppNavigation();
  const [query, setQuery] = useState("");

  useEffect(() => {
    void tasksStore.bootstrap(true);
    const timer = window.setInterval(
      () => void tasksStore.bootstrap(true),
      5000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const runs = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return tasksStore.agentRuns;
    return tasksStore.agentRuns.filter((run) =>
      `${run.title} ${run.agentName ?? ""} ${run.scenarioName ?? ""} ${run.runId}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [query, tasksStore.agentRuns]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title="Задачи"
        description="История запусков фоновых задач."
        breadcrumbs={[{ label: "Задачи" }]}
        footer={
          <Tabs
            value="scenarios-runs"
            onChange={() => undefined}
            options={[
              {
                value: "scenarios-runs",
                label: `Сценарии · ${tasksStore.agentRuns.length}`,
              },
            ]}
          />
        }
      >
        <InputSmall
          preset="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          placeholder="Найти запуск"
          className="w-64"
        />
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1 p-1">
        {runs.length ? (
          <div className="overflow-hidden">
            <TasksScenarioRunsListTable
              runs={runs}
              scenarioExists={(id) => Boolean(automationStore.getScenario(id))}
              onOpenDetails={(run) =>
                goTo(
                  APP_PATHS.automation.scenarios.execution.replace(
                    ":runId",
                    String(run.runId),
                  ),
                )
              }
              onOpenScenario={(run) =>
                run.scenarioId &&
                goTo(
                  APP_PATHS.automation.scenarios.edit.replace(
                    ":scenarioId",
                    run.scenarioId,
                  ),
                )
              }
            />
          </div>
        ) : (
          <div className="grid min-h-80 place-items-center">
            <EmptyState
              icon={<TasksIcon className="size-6" />}
              title={query ? "Запуски не найдены" : "Запусков пока нет"}
              description={
                tasksStore.error ??
                (query
                  ? "Измените поисковый запрос."
                  : "Здесь появится история запусков фоновых задач.")
              }
            />
          </div>
        )}
      </ScrollArea>
    </section>
  );
});
