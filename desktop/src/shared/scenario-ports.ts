export type ScenarioPortKind =
  | "text-input"
  | "text-output"
  | "event-output"
  | "worker-input"
  | "worker-output"
  | "knowledge-input"
  | "knowledge-output"
  | "files-input"
  | "files-output";

export type ScenarioEdgeKind = "text" | "worker" | "knowledge" | "files";

export type ScenarioNodeKind =
  | "trigger"
  | "orchestrator"
  | "agent"
  | "knowledge_store"
  | "download_files"
  | "read_files"
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
  textIn: {
    id: "text-in",
    kind: "text-input",
    direction: "target",
    side: "left",
    label: "Входящий текст",
    multiple: true,
  },
  textOut: {
    id: "text-out",
    kind: "text-output",
    direction: "source",
    side: "right",
    label: "Текст",
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
  telegramAttachmentsOut: {
    id: "attachments-telegram-out",
    kind: "files-output",
    direction: "source",
    side: "right",
    label: "Вложения Telegram",
    multiple: true,
  },
  emailAttachmentsOut: {
    id: "attachments-email-out",
    kind: "files-output",
    direction: "source",
    side: "right",
    label: "Вложения письма",
    multiple: true,
  },
  chatAttachmentsOut: {
    id: "attachments-chat-out",
    kind: "files-output",
    direction: "source",
    side: "right",
    label: "Вложения из чата",
    multiple: true,
  },
  filesIn: {
    id: "files-in",
    kind: "files-input",
    direction: "target",
    side: "left",
    label: "Файлы для скачивания",
    multiple: true,
  },
  filesOut: {
    id: "files-out",
    kind: "files-output",
    direction: "source",
    side: "right",
    label: "Скачанные файлы",
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
    "text-input": [],
    "text-output": ["text-input"],
    "event-output": ["text-input"],
    "worker-input": [],
    "worker-output": ["worker-input"],
    "knowledge-input": [],
    "knowledge-output": ["knowledge-input"],
    "files-input": [],
    "files-output": ["files-input"],
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
  if (kind === "text-output" || kind === "event-output") return "text";
  if (kind === "worker-output") return "worker";
  if (kind === "knowledge-output") return "knowledge";
  if (kind === "files-output") return "files";
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
    case "files":
      return (
        (sourceKind === "trigger" && targetKind === "download_files") ||
        (sourceKind === "download_files" && targetKind === "read_files")
      );
    case "text":
      if (sourceKind === "read_files") return targetKind === "orchestrator";
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
    case "worker":
      return (
        (sourceKind === "orchestrator" || sourceKind === "agent") &&
        targetKind === "agent"
      );
    default:
      return false;
  }
}
