import type { ScenarioEdge, ScenarioGraph, ScenarioNode } from "../../../../shared/scenario/graph";

const MAX_DEPTH = 12;

const PASS_THROUGH = new Set([
  "if",
  "switch",
  "filter",
  "merge",
  "limit",
  "sort",
  "deduplicate",
  "loop",
  "approval",
  "noop",
  "classify",
  "subScenario",
]);

const TRIGGER_BASE = {
  trigger: "",
  triggerBindingId: "",
};

const TELEGRAM_ENTITY = {
  type: "telegram_message",
  updateId: 0,
  messageId: 0,
  sentAt: "",
  text: "",
  chat: { id: "", type: "", title: "", username: "" },
  sender: { id: "", username: "", firstName: "", lastName: "", isBot: false },
  replyToMessageId: 0,
  attachments: [] as unknown[],
};

const EMAIL_ENTITY = {
  type: "email_message",
  uid: 0,
  messageId: "",
  sentAt: "",
  subject: "",
  from: [] as unknown[],
  to: [] as unknown[],
  cc: [] as unknown[],
  text: "",
  attachments: [] as unknown[],
};

const CHAT_ENTITY = {
  type: "chat_message",
  conversationId: 0,
  messageId: 0,
  text: "",
  attachments: [] as unknown[],
};

export function inferNodeOutputShape(
  nodeId: string,
  graph: ScenarioGraph,
): Record<string, unknown> | undefined {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const node = byId.get(nodeId);
  return node ? output(node, graph, byId, new Set(), 0) : undefined;
}

export function inferIncomingShape(
  nodeId: string,
  graph: ScenarioGraph,
): Record<string, unknown> | undefined {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return incoming(nodeId, graph, byId, new Set(), 0);
}

function incoming(
  nodeId: string,
  graph: ScenarioGraph,
  byId: Map<string, ScenarioNode>,
  seen: Set<string>,
  depth: number,
): Record<string, unknown> | undefined {
  if (depth > MAX_DEPTH || seen.has(nodeId)) return undefined;
  seen.add(nodeId);

  const sources = graph.edges.filter(
    (edge: ScenarioEdge) => edge.target === nodeId && edge.targetPort !== "knowledge",
  );

  let merged: Record<string, unknown> | undefined;
  for (const edge of sources) {
    const source = byId.get(edge.source);
    if (!source) continue;
    const shape = output(source, graph, byId, seen, depth + 1);
    if (!shape) continue;
    merged = merged ? { ...merged, ...shape } : shape;
  }
  return merged;
}

function output(
  node: ScenarioNode,
  graph: ScenarioGraph,
  byId: Map<string, ScenarioNode>,
  seen: Set<string>,
  depth: number,
): Record<string, unknown> | undefined {
  const config = (node.config ?? {}) as Record<string, unknown>;
  const field = (key: string, fallback: string) =>
    String(config[key] ?? "").trim() || fallback;

  if (PASS_THROUGH.has(node.kind))
    return incoming(node.id, graph, byId, seen, depth);

  switch (node.kind) {
    case "trigger.telegram":
      return { ...TRIGGER_BASE, entity: TELEGRAM_ENTITY };
    case "trigger.email":
      return { ...TRIGGER_BASE, entity: EMAIL_ENTITY };
    case "trigger.manual":
      return { ...TRIGGER_BASE, entity: CHAT_ENTITY };
    case "trigger.interval":
      return { ...TRIGGER_BASE, firedAt: "" };

    case "agent":
      return { [field("targetField", "text")]: "" };
    case "orchestrator":
      return { text: "" };

    case "readFiles":
      return {
        [field("targetField", "text")]: "",
        fileName: "",
        mimeType: "",
        truncated: false,
      };
    case "downloadFiles":
      return { files: [] };
    case "http":
      return { status: 0, ok: false, headers: {}, data: {} };

    case "set": {
      const fields = Array.isArray(config.fields)
        ? (config.fields as Array<Record<string, unknown>>)
        : [];
      const own: Record<string, unknown> = {};
      for (const entry of fields) {
        const name = String(entry.name ?? "").trim();
        if (name) own[name] = "";
      }
      if (config.keepOnlySet) return own;
      const upstream = incoming(node.id, graph, byId, seen, depth) ?? {};
      const removed = Array.isArray(config.remove)
        ? (config.remove as string[])
        : [];
      const result = { ...upstream, ...own };
      for (const key of removed) delete result[key];
      return result;
    }

    case "aggregate": {
      const aggregations = Array.isArray(config.aggregations)
        ? (config.aggregations as Array<Record<string, unknown>>)
        : [];
      if (aggregations.length) {
        const own: Record<string, unknown> = {};
        for (const entry of aggregations) {
          const name =
            String(entry.as ?? "").trim() || String(entry.field ?? "").trim();
          if (name) own[name] = 0;
        }
        return own;
      }
      return { [field("targetField", "data")]: [] };
    }

    case "splitOut": {
      const own = { [field("targetField", "value")]: "" };
      if (!config.keepParentFields) return own;
      return { ...(incoming(node.id, graph, byId, seen, depth) ?? {}), ...own };
    }

    default:
      return undefined;
  }
}
