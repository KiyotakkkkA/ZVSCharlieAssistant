import { ScenarioRun, ScenarioNodeRun } from "@ipc/contracts";
import {
  EmptyState,
  Button,
  ScrollArea,
  Timeline,
  CodeView,
} from "@kiyotakkkka/zvs-uikit-lib";
import { APP_PATHS } from "@renderer/app/routes";
import {
  TasksIcon,
  ChevronLeftIcon,
  GraphIcon,
  ChevronDownIcon,
} from "@renderer/components/atoms";
import { PageHeader } from "@renderer/components/organisms";
import { useHashRouter } from "@renderer/hooks";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";

type Execution = { run: ScenarioRun; nodes: ScenarioNodeRun[] };

const statusLabels: Record<ScenarioRun["status"], string> = {
  queued: "В очереди",
  running: "Выполняется",
  waiting_for_approval: "Ожидает подтверждения",
  completed: "Завершён",
  failed: "Ошибка",
  cancelled: "Отменён",
};

const originLabels: Record<ScenarioRun["origin"], string> = {
  manual: "Ручной запуск",
  chat: "Из чата",
  background: "Фоновый запуск",
};

const nodeLabels: Record<ScenarioNodeRun["nodeKind"], string> = {
  trigger: "Триггер",
  orchestrator: "Оркестратор",
  agent: "Агент",
  knowledge_store: "Хранилище",
  download_files: "Скачивание файлов",
  read_files: "Чтение файлов",
  condition: "Условие",
  approval: "Подтверждение",
  output: "Результат",
};

const nodeIcons: Record<ScenarioNodeRun["nodeKind"], string> = {
  trigger: "mdi:message-outline",
  orchestrator: "mdi:robot-outline",
  agent: "mdi:account-cog-outline",
  knowledge_store: "mdi:database-search-outline",
  download_files: "mdi:download-outline",
  read_files: "mdi:file-document-outline",
  condition: "mdi:source-branch",
  approval: "mdi:check-decagram-outline",
  output: "mdi:send-outline",
};

export function ScenarioExecHistoryPage() {
  const { runId } = useParams<{ runId: string }>();
  const { goBack, goTo } = useHashRouter();
  const [execution, setExecution] = useState<Execution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const numericRunId = Number(runId);

  useEffect(() => {
    if (!Number.isInteger(numericRunId) || numericRunId <= 0) {
      setError("Некорректный идентификатор запуска");
      return;
    }
    let disposed = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const value =
          await window.desktop.automation.getScenarioRun(numericRunId);
        if (disposed) return;
        setExecution(value);
        setError(null);
        if (
          ["queued", "running", "waiting_for_approval"].includes(
            value.run.status,
          )
        ) {
          timer = window.setTimeout(load, 2000);
        }
      } catch (cause) {
        if (!disposed)
          setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось загрузить запуск",
          );
      }
    };
    void load();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [numericRunId]);

  const stats = useMemo(() => {
    if (!execution) return null;
    const finished = execution.nodes.filter(
      (node) => node.status === "completed",
    ).length;
    const failed = execution.nodes.filter(
      (node) => node.status === "failed",
    ).length;
    const attempts = execution.nodes.reduce(
      (sum, node) => sum + node.attempt,
      0,
    );
    return {
      finished,
      failed,
      attempts,
      duration: formatDuration(execution.run),
    };
  }, [execution]);

  if (!execution) {
    return (
      <div className="grid h-full place-items-center p-4">
        {error ? (
          <EmptyState
            icon={<TasksIcon className="size-6" />}
            title="Запуск не найден"
            description={error}
          />
        ) : (
          <span className="text-sm text-main-500">
            Загрузка истории запуска…
          </span>
        )}
      </div>
    );
  }

  const { run, nodes } = execution;
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <PageHeader
        title={`${run.scenarioName} · запуск #${run.id}`}
        description={`${originLabels[run.origin]}`}
        breadcrumbs={[
          { label: "Автоматизация" },
          { label: "Сценарии", to: APP_PATHS.automation.scenarios.index },
          { label: `Запуск #${run.id}` },
        ]}
      >
        <Button variant="ghost" onClick={() => goBack()}>
          <ChevronLeftIcon className="size-4" />
          Назад
        </Button>
        <Button
          variant="primary"
          className="px-2"
          onClick={() =>
            goTo(
              APP_PATHS.automation.scenarios.edit.replace(
                ":scenarioId",
                run.scenarioId,
              ),
            )
          }
        >
          <GraphIcon className="size-4" />
          Сценарий
        </Button>
      </PageHeader>

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto max-w-6xl space-y-5 pb-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Статус"
              value={statusLabels[run.status]}
              tone={run.status}
            />
            <Metric label="Длительность" value={stats!.duration} />
            <Metric
              label="Шаги"
              value={`${stats!.finished} из ${nodes.length}`}
            />
            <Metric label="Ошибки" value={String(stats!.failed)} />
          </div>

          {run.error ? (
            <div className="rounded-xl border border-danger-medium/30 bg-danger-medium/10 p-4">
              <p className="text-sm font-medium text-danger-light">
                Ошибка выполнения
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-main-300">
                {run.error}
              </p>
            </div>
          ) : null}

          <DataSection
            title="Вход запуска"
            value={run.input}
            fileName="input.json"
          />

          <section className="rounded-xl border border-main-700/50 bg-main-800/25 p-5">
            <div className="mb-5">
              <h2 className="font-semibold text-main-100">Ход выполнения</h2>
              <p className="mt-1 text-xs text-main-500">
                Последовательность и данные узлов сценария.
              </p>
            </div>
            <Timeline>
              {nodes.map((node) => {
                const isExpanded = expanded.has(node.id);
                return (
                  <Timeline.Item key={node.id} icon={nodeIcons[node.nodeKind]}>
                    <Timeline.ItemTitle className="flex items-center justify-between gap-3">
                      <span>
                        {nodeLabels[node.nodeKind]} · {node.nodeId}
                      </span>
                      <Button
                        variant="ghost"
                        className="size-7 p-0"
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded
                            ? "Скрыть данные шага"
                            : "Показать данные шага"
                        }
                        onClick={() =>
                          setExpanded((current) => toggleSet(current, node.id))
                        }
                      >
                        <ChevronDownIcon
                          className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </Timeline.ItemTitle>
                    <Timeline.ItemSubTitle>
                      {statusLabels[node.status]} · попытка {node.attempt} ·{" "}
                      {formatNodeDuration(node)}
                    </Timeline.ItemSubTitle>
                    <Timeline.ItemContent>
                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-300 ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                      >
                        <div className="min-h-0 overflow-hidden">
                          <div className="grid gap-4 pt-3 lg:grid-cols-2">
                            <DataValue
                              title="Вход"
                              value={node.input}
                              fileName={`${node.nodeId}-input.json`}
                            />
                            <DataValue
                              title={node.error ? "Ошибка" : "Результат"}
                              value={node.error ?? node.output}
                              fileName={`${node.nodeId}-output.json`}
                            />
                          </div>
                        </div>
                      </div>
                    </Timeline.ItemContent>
                  </Timeline.Item>
                );
              })}
            </Timeline>
          </section>

          <DataSection
            title="Итоговый результат"
            value={run.output}
            fileName="output.json"
          />
        </div>
      </ScrollArea>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: ScenarioRun["status"];
}) {
  const color =
    tone === "completed"
      ? "text-success-light"
      : tone === "failed"
        ? "text-danger-light"
        : tone === "running"
          ? "text-accent-light"
          : "text-main-100";
  return (
    <div className="rounded-xl border border-main-700/40 bg-main-800/35 p-4">
      <p className="text-xs text-main-500">{label}</p>
      <p className={`mt-2 font-medium ${color}`}>{value}</p>
    </div>
  );
}

function DataSection({
  title,
  value,
  fileName,
}: {
  title: string;
  value: unknown;
  fileName: string;
}) {
  return (
    <section className="rounded-xl border border-main-700/50 bg-main-800/25 p-5">
      <h2 className="mb-4 font-semibold text-main-100">{title}</h2>
      <DataValue title={title} value={value} fileName={fileName} />
    </section>
  );
}

function DataValue({
  title,
  value,
  fileName,
}: {
  title: string;
  value: unknown;
  fileName: string;
}) {
  const json =
    typeof value === "string" ? value : JSON.stringify(value ?? null, null, 2);
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs text-main-500">{title}</p>
      <CodeView
        code={json}
        language={typeof value === "string" ? "text" : "json"}
        fileName={fileName}
        copyable
        defaultActions
        maxContentHeight={320}
      />
    </div>
  );
}

function toggleSet(current: Set<number>, id: number) {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(
    value.includes("T") ? value : `${value.replace(" ", "T")}Z`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(run: ScenarioRun) {
  const start = parseDate(run.startedAt ?? run.createdAt);
  const end =
    parseDate(run.completedAt) ??
    (run.status === "running" ? new Date() : null);
  return start && end
    ? formatMilliseconds(end.getTime() - start.getTime())
    : "—";
}

function formatNodeDuration(node: ScenarioNodeRun) {
  const start = parseDate(node.startedAt);
  const end = parseDate(node.completedAt);
  return start && end
    ? formatMilliseconds(end.getTime() - start.getTime())
    : "—";
}

function formatMilliseconds(value: number) {
  const seconds = Math.max(0, Math.round(value / 1000));
  if (seconds < 60) return `${seconds} сек.`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} мин. ${seconds % 60} сек.`;
}
