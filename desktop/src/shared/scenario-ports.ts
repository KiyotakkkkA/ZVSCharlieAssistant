export type ScenarioPortKind =
  | "control-input"
  | "control-output"
  | "event-output"
  | "worker-input"
  | "worker-output"
  | "knowledge-input"
  | "knowledge-output";

export type ScenarioEdgeKind = "control" | "worker" | "knowledge";

export type ScenarioNodeKind =
  | "trigger"
  | "orchestrator"
  | "agent"
  | "knowledge_store"
  | "condition"
  | "approval"
  | "output";

export interface ScenarioPortDefinition {
  id: string;
  kind: ScenarioPortKind;
  direction: "source" | "target";
  side: "top" | "right" | "bottom" | "left";
  label: string;
  multiple: boolean;
}

export const SCENARIO_PORTS = {
  controlIn: {
    id: "control-in",
    kind: "control-input",
    direction: "target",
    side: "left",
    label: "Управляющий вход",
    multiple: false,
  },
  controlOut: {
    id: "control-out",
    kind: "control-output",
    direction: "source",
    side: "right",
    label: "Следующий шаг",
    multiple: true,
  },
  telegramMessageOut: {
    id: "event-telegram-message-out",
    kind: "event-output",
    direction: "source",
    side: "right",
    label: "Сообщение Telegram",
    multiple: true,
  },
  emailMessageOut: {
    id: "event-email-message-out",
    kind: "event-output",
    direction: "source",
    side: "right",
    label: "Электронное письмо",
    multiple: true,
  },
  workerIn: {
    id: "worker-in",
    kind: "worker-input",
    direction: "target",
    side: "top",
    label: "Задача от оркестратора",
    multiple: true,
  },
  workerOut: {
    id: "workers",
    kind: "worker-output",
    direction: "source",
    side: "bottom",
    label: "Исполнитель",
    multiple: true,
  },
  knowledgeIn: {
    id: "knowledge-in",
    kind: "knowledge-input",
    direction: "target",
    side: "left",
    label: "Контекст из хранилища",
    multiple: true,
  },
  knowledgeOut: {
    id: "knowledge-out",
    kind: "knowledge-output",
    direction: "source",
    side: "right",
    label: "База знаний",
    multiple: true,
  },
} as const satisfies Record<string, ScenarioPortDefinition>;

const PORTS_BY_ID = new Map<string, ScenarioPortDefinition>(
  Object.values(SCENARIO_PORTS).map((port) => [port.id, port]),
);

const COMPATIBLE_PORTS: Record<ScenarioPortKind, readonly ScenarioPortKind[]> =
  {
    "control-input": [],
    "control-output": ["control-input"],
    "event-output": ["control-input"],
    "worker-input": [],
    "worker-output": ["worker-input"],
    "knowledge-input": [],
    "knowledge-output": ["knowledge-input"],
  };

export interface ScenarioConnectionLike {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export function getScenarioPort(id?: string | null) {
  return id ? PORTS_BY_ID.get(id) : undefined;
}

export function getScenarioEdgeKind(
  sourcePort?: string | null,
): ScenarioEdgeKind | undefined {
  const kind = getScenarioPort(sourcePort)?.kind;
  if (kind === "control-output" || kind === "event-output") return "control";
  if (kind === "worker-output") return "worker";
  if (kind === "knowledge-output") return "knowledge";
  return undefined;
}

export function isScenarioConnectionValid(
  connection: ScenarioConnectionLike,
  nodeKinds: ReadonlyMap<string, ScenarioNodeKind>,
): boolean {
  if (
    !connection.source ||
    !connection.target ||
    connection.source === connection.target
  )
    return false;
  const sourceKind = nodeKinds.get(connection.source);
  const targetKind = nodeKinds.get(connection.target);
  const sourcePort = getScenarioPort(connection.sourceHandle);
  const targetPort = getScenarioPort(connection.targetHandle);
  if (!sourceKind || !targetKind || !sourcePort || !targetPort) return false;
  if (
    sourcePort.direction !== "source" ||
    targetPort.direction !== "target" ||
    !COMPATIBLE_PORTS[sourcePort.kind].includes(targetPort.kind)
  )
    return false;

  switch (getScenarioEdgeKind(sourcePort.id)) {
    case "knowledge":
      return sourceKind === "knowledge_store" && targetKind === "agent";
    case "worker":
      return (
        (sourceKind === "orchestrator" || sourceKind === "agent") &&
        targetKind === "agent"
      );
    case "control":
      if (sourcePort.kind === "event-output" && sourceKind !== "trigger")
        return false;
      return (
        sourceKind !== "agent" &&
        sourceKind !== "output" &&
        sourceKind !== "knowledge_store" &&
        targetKind !== "agent" &&
        targetKind !== "trigger" &&
        targetKind !== "knowledge_store"
      );
    default:
      return false;
  }
}
