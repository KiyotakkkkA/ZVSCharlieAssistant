import {
  SCENARIO_GRAPH_VERSION,
  scenarioGraphSchema,
  type ScenarioEdge,
  type ScenarioGraph,
  type ScenarioNode,
} from "../../src/shared/scenario/graph";

let counter = 0;
const nextId = (_prefix: string): string =>
  `019cba09-8f30-7000-8000-${String(++counter).padStart(12, "0")}`;

export function resetIds(): void {
  counter = 0;
}

export function node(
  kind: string,
  overrides: Partial<ScenarioNode> & { name?: string } = {},
): ScenarioNode {
  const id = overrides.id ?? nextId("n");
  return {
    id,
    kind,
    name: overrides.name ?? id,
    description: "",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    config: overrides.config ?? {},
    runtime: overrides.runtime ?? {},
    disabled: overrides.disabled ?? false,
    notes: "",
    groupId: null,
  };
}

export function edge(
  source: ScenarioNode | string,
  target: ScenarioNode | string,
  ports: { from?: string; to?: string } = {},
): ScenarioEdge {
  const sourceId = typeof source === "string" ? source : source.id;
  const targetId = typeof target === "string" ? target : target.id;
  return {
    id: nextId("e"),
    source: sourceId,
    sourcePort: ports.from ?? "main",
    target: targetId,
    targetPort: ports.to ?? "main",
  };
}

export function graph(
  nodes: ScenarioNode[],
  edges: ScenarioEdge[] = [],
  extra: Partial<ScenarioGraph> = {},
): ScenarioGraph {
  return scenarioGraphSchema.parse({
    version: SCENARIO_GRAPH_VERSION,
    nodes,
    edges,
    ...extra,
  });
}

export function minimalGraph(): {
  graph: ScenarioGraph;
  nodes: Record<string, ScenarioNode>;
} {
  const trigger = node("trigger.manual", { name: "Старт" });
  const passthrough = node("noop", { name: "Середина" });
  const output = node("output", {
    name: "Итог",
    config: { text: "{{ $json.text }}", channels: [] },
  });
  return {
    graph: graph(
      [trigger, passthrough, output],
      [edge(trigger, passthrough), edge(passthrough, output)],
    ),
    nodes: { trigger, passthrough, output },
  };
}

export const errorsOf = (
  issues: Array<{ severity: string; message: string }>,
): string[] =>
  issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => issue.message);

export const warningsOf = (
  issues: Array<{ severity: string; message: string }>,
): string[] =>
  issues
    .filter((issue) => issue.severity === "warning")
    .map((issue) => issue.message);
