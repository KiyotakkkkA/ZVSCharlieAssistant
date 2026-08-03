import { ScenarioNodeRun, ScenarioRun } from "@ipc/contracts";
import { Button, Timeline } from "@kiyotakkkka/zvs-uikit-lib";
import { ChevronDownIcon } from "@renderer/components/atoms";
import { useState } from "react";

function formatNodeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).text === "string"
  )
    return String((value as Record<string, unknown>).text);
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function resolveNodeLabel(node: ScenarioNodeRun) {
  return {
    trigger: "Начало исполнения",
    orchestrator: "Оркестрирование",
    agent: `Вызов агента : ${node.nodeId}`,
    knowledge_store: "Хранилище",
    condition: "Условие",
    approval: "Подтверждение",
    output: "Результат",
  }[node.nodeKind];
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
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const running = ["queued", "running", "waiting_for_approval"].includes(
    execution.run.status,
  );
  const toggleNode = (nodeId: number) =>
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });

  return (
    <section className="mb-5 overflow-hidden rounded-xl bg-main-800/40 ring-1 ring-main-700/40">
      <header className="flex items-center justify-between gap-4 border-b border-main-700/30 px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-main-200">
            {execution.run.scenarioName}
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
            const hasContent = Boolean(node.error || text);
            const expanded = hasContent && expandedNodes.has(node.id);
            return (
              <Timeline.Item key={node.id} icon={nodeKindIcon(node.nodeKind)}>
                <Timeline.ItemTitle className="flex min-w-0 items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {resolveNodeLabel(node)}
                  </span>
                  {hasContent ? (
                    <Button
                      type="button"
                      rounded="rounded-lg"
                      variant="ghost"
                      aria-expanded={expanded}
                      aria-label={expanded ? "Свернуть шаг" : "Развернуть шаг"}
                      onClick={() => toggleNode(node.id)}
                      className="size-7 shrink-0 p-0 text-main-400 hover:bg-main-600/20 hover:text-main-50"
                    >
                      <ChevronDownIcon
                        className={`size-4 transition-transform duration-300 ease-out ${expanded ? "rotate-180" : "rotate-0"}`}
                      />
                    </Button>
                  ) : null}
                </Timeline.ItemTitle>
                <Timeline.ItemSubTitle>
                  {scenarioStatusLabel(node.status)}
                </Timeline.ItemSubTitle>
                {hasContent ? (
                  <Timeline.ItemContent>
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div
                          className={`max-h-72 overflow-auto whitespace-pre-wrap pt-2 text-xs leading-5 ${
                            node.error ? "text-danger-light" : "text-main-400"
                          }`}
                        >
                          {node.error ?? text}
                        </div>
                      </div>
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
