import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  EmptyState,
  InputSmall,
  Modal,
  ScrollArea,
  Tabs,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "../../app/routes";
import { TasksIcon } from "../../components/atoms";
import type { EntityGenerationRun } from "../../../ipc/contracts";
import { PageHeader } from "../../components/organisms";
import { useAppNavigation } from "../../hooks";
import {
  automationStore,
  entityGenerationStore,
  tasksStore,
  textProviderStore,
} from "../../stores";
import {
  TasksCreationRunsListTable,
  TasksScenarioRunsListTable,
} from "@renderer/components/organisms/tables";
import { GenerationQuestionModal } from "../../components/organisms/tasks/GenerationQuestionModal";

type TaskTab = "scenarios-runs" | "creation-runs";

export const TaskListPage = observer(function TaskListPage() {
  const { goTo } = useAppNavigation();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TaskTab>("scenarios-runs");
  const [failed, setFailed] = useState<EntityGenerationRun | null>(null);
  const [answering, setAnswering] = useState<EntityGenerationRun | null>(null);

  useEffect(() => {
    const refresh = () => {
      void tasksStore.bootstrap(true);
      void entityGenerationStore.bootstrap(true);
    };
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const normalized = query.trim().toLocaleLowerCase();

  const runs = useMemo(() => {
    if (!normalized) return tasksStore.agentRuns;
    return tasksStore.agentRuns.filter((run) =>
      `${run.title} ${run.agentName ?? ""} ${run.scenarioName ?? ""} ${run.runId}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [normalized, tasksStore.agentRuns]);

  const creationRuns = useMemo(() => {
    if (!normalized) return entityGenerationStore.runs;
    return entityGenerationStore.runs.filter((run) =>
      `${run.prompt} ${run.entityName ?? ""} ${run.id}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [normalized, entityGenerationStore.runs]);

  const empty = tab === "scenarios-runs" ? !runs.length : !creationRuns.length;

  return (
    <section
      data-tour="tasks-page"
      className="flex h-full min-h-0 flex-col overflow-hidden p-4"
    >
      <PageHeader
        title="Задачи"
        description="История запусков фоновых задач."
        breadcrumbs={[{ label: "Задачи" }]}
        footer={
          <div data-tour="tasks-tabs">
            <Tabs
              value={tab}
              onChange={(value) => setTab(value as TaskTab)}
              options={[
                {
                  value: "scenarios-runs",
                  label: `Сценарии · ${tasksStore.agentRuns.length}`,
                },
                {
                  value: "creation-runs",
                  label: `Создание · ${entityGenerationStore.runs.length}`,
                },
              ]}
            />
          </div>
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

      <ScrollArea data-tour="tasks-list" className="min-h-0 flex-1 p-1">
        {empty ? (
          <div className="grid min-h-80 place-items-center">
            <EmptyState
              icon={<TasksIcon className="size-6" />}
              title={query ? "Запуски не найдены" : "Запусков пока нет"}
              description={
                tasksStore.error ??
                entityGenerationStore.error ??
                (query
                  ? "Измените поисковый запрос."
                  : tab === "creation-runs"
                    ? "Здесь появятся генерации агентов и навыков."
                    : "Здесь появятся запуски агентов и сценариев, их статус и результат.")
              }
            />
          </div>
        ) : tab === "scenarios-runs" ? (
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
          <div className="overflow-hidden">
            <TasksCreationRunsListTable
              runs={creationRuns}
              modelLabel={textProviderStore.modelLabel}
              onShowError={setFailed}
              onAnswerQuestion={setAnswering}
              onOpenDetail={(run) =>
                goTo(
                  APP_PATHS.taskCreationDetail.replace(":runId", run.id),
                )
              }
              onOpenEntity={(run) =>
                run.entityId &&
                goTo(
                  run.kind === "agent"
                    ? APP_PATHS.automation.agents.edit.replace(
                        ":agentId",
                        run.entityId,
                      )
                    : run.kind === "skill"
                      ? APP_PATHS.automation.skills.edit.replace(
                          ":skillId",
                          run.entityId,
                        )
                      : APP_PATHS.automation.scenarios.edit.replace(
                          ":scenarioId",
                          run.entityId,
                        ),
                )
              }
            />
          </div>
        )}
      </ScrollArea>

      <Modal
        open={failed !== null}
        rounded="rounded-4xl"
        className="max-w-2xl"
        onClose={() => setFailed(null)}
      >
        <Modal.Header>
          <h2 className="text-lg font-semibold text-main-50">
            Генерация не удалась
          </h2>
        </Modal.Header>
        <Modal.Content>
          <div className="space-y-4">
            <Alert variant="danger" title="Текст ошибки">
              <p className="whitespace-pre-wrap wrap-break-word text-xs leading-5">
                {failed?.error ?? "Причина не сохранилась."}
              </p>
            </Alert>
            <div>
              <p className="mb-1 text-xs font-medium text-main-400">Запрос</p>
              <p className="whitespace-pre-wrap wrap-break-word rounded-lg bg-main-800/40 p-3 text-xs leading-5 text-main-300">
                {failed?.prompt}
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setFailed(null)}>
                Закрыть
              </Button>
            </div>
          </div>
        </Modal.Content>
      </Modal>

      <GenerationQuestionModal run={answering} onClose={() => setAnswering(null)} />
    </section>
  );
});
