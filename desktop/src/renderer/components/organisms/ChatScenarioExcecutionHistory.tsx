import { ScenarioNodeRun, ScenarioRun } from "@ipc/contracts";
import { Timeline } from "@kiyotakkkka/zvs-uikit-lib";

function formatNodeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).text === "string"
  )
    return String((value as Record<string, unknown>).text);
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function nodeKindLabel(kind: ScenarioNodeRun["nodeKind"]) {
  return {
    trigger: "Триггер",
    orchestrator: "Оркестратор",
    agent: "Агент",
    knowledge_store: "Хранилище",
    condition: "Условие",
    approval: "Подтверждение",
    output: "Результат",
  }[kind];
}

function nodeKindIcon(kind: ScenarioNodeRun["nodeKind"]) {
  return {
    trigger: "mdi:message-outline",
    orchestrator: "mdi:robot-outline",
    agent: "mdi:account-cog-outline",
    knowledge_store: "mdi:database-search-outline",
    condition: "mdi:source-branch",
    approval: "mdi:check-decagram-outline",
    output: "mdi:send-outline",
  }[kind];
}

function scenarioStatusLabel(status: ScenarioRun["status"]) {
  return {
    queued: "В очереди",
    running: "Выполняется",
    waiting_for_approval: "Ожидает подтверждения",
    completed: "Завершено",
    failed: "Ошибка",
    cancelled: "Отменено",
  }[status];
}

export const ScenarioExecutionHistory = ({
  execution,
  liveOutput,
}: {
  execution: { run: ScenarioRun; nodes: ScenarioNodeRun[] };
  liveOutput: Map<string, string>;
}) => {
  const running = ["queued", "running", "waiting_for_approval"].includes(
    execution.run.status,
  );
  return (
    <section className="mb-5 overflow-hidden rounded-xl bg-main-800/40 ring-1 ring-main-700/40">
      <header className="flex items-center justify-between gap-4 border-b border-main-700/30 px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-main-200">
            {execution.run.scenarioName}
          </span>
          <span className="mt-0.5 block text-[11px] text-main-500">
            Выполнение #{execution.run.id} · {execution.nodes.length} шагов
          </span>
        </span>
        <span
          className={`flex shrink-0 items-center gap-2 text-[11px] ${
            running
              ? "text-accent-light"
              : execution.run.status === "completed"
                ? "text-success-light"
                : "text-danger-light"
          }`}
        >
          {running ? (
            <span className="size-1.5 animate-pulse rounded-full bg-accent-light" />
          ) : null}
          {scenarioStatusLabel(execution.run.status)}
        </span>
      </header>
      <div className="px-4 py-4">
        <Timeline>
          {execution.nodes.map((node) => {
            const exposesContent =
              node.nodeKind !== "trigger" && node.nodeKind !== "output";
            const text = exposesContent
              ? ((running ? liveOutput.get(node.nodeId) : undefined) ??
                formatNodeValue(node.output))
              : "";
            return (
              <Timeline.Item key={node.id} icon={nodeKindIcon(node.nodeKind)}>
                <Timeline.ItemTitle>
                  {nodeKindLabel(node.nodeKind)} · {node.nodeId}
                </Timeline.ItemTitle>
                <Timeline.ItemSubTitle>
                  {scenarioStatusLabel(node.status)}
                </Timeline.ItemSubTitle>
                {node.error || text ? (
                  <Timeline.ItemContent>
                    <div
                      className={`max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 ${
                        node.error ? "text-danger-light" : "text-main-400"
                      }`}
                    >
                      {node.error ?? text}
                    </div>
                  </Timeline.ItemContent>
                ) : null}
              </Timeline.Item>
            );
          })}
        </Timeline>
      </div>
    </section>
  );
};
