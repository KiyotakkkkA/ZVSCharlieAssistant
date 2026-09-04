import type { z } from "zod";
import { hasExpression, validateExpressions } from "../expressions";
import { PermanentError } from "./errors";
import {
  SCENARIO_GRAPH_VERSION,
  type NodeErrorMode,
  type NodeRetryPolicy,
  type ScenarioDataKind,
  type ScenarioEdge,
  type ScenarioGraph,
  type ScenarioNode,
  type ScenarioValidationIssue,
  type ScenarioValidationResult,
} from "./graph";

const FLOW_KINDS = new Set<ScenarioDataKind>(["main", "files"]);
import type { ScenarioDescriptorRegistry } from "./descriptor-registry";
import {
  resolvePorts,
  type PortSpec,
  type ScenarioNodeDescriptor,
} from "./node-descriptor";

export interface ResolvedNodeRuntime {
  retry: NodeRetryPolicy;
  onError: NodeErrorMode;
  timeoutSeconds: number;
  itemMode: "collection" | "each";
  concurrency: number;
}

export interface CompiledNode {
  node: ScenarioNode;
  descriptor: ScenarioNodeDescriptor<never>;
  inputs: PortSpec[];
  outputs: PortSpec[];
  runtime: ResolvedNodeRuntime;
  requiredInputs: string[];
}

export interface CompiledScenario {
  nodes: Map<string, CompiledNode>;
  triggers: string[];
  order: string[];
  backEdgeIds: Set<string>;
  outgoing: Map<string, Map<string, ScenarioEdge[]>>;
  incoming: Map<string, Map<string, ScenarioEdge[]>>;
  nodeIdByName: Map<string, string>;
  nameByNodeId: Map<string, string>;
  variables: Record<string, unknown>;
  maxNodeExecutions: number;
}

const DEFAULT_RETRY: NodeRetryPolicy = {
  maxTries: 1,
  backoffMs: 1_000,
  backoffFactor: 2,
  maxBackoffMs: 60_000,
};

const DEFAULT_TIMEOUT_SECONDS = 300;

function resolveRuntime(
  node: ScenarioNode,
  descriptor: ScenarioNodeDescriptor<never>,
): ResolvedNodeRuntime {
  const descriptorRetry = descriptor.defaults?.retry ?? {};
  const nodeRetry = node.runtime?.retry ?? {};
  return {
    retry: { ...DEFAULT_RETRY, ...descriptorRetry, ...nodeRetry },
    onError: node.runtime?.onError ?? descriptor.defaults?.onError ?? "stop",
    timeoutSeconds:
      node.runtime?.timeoutSeconds ??
      descriptor.defaults?.timeoutSeconds ??
      DEFAULT_TIMEOUT_SECONDS,
    itemMode: node.runtime?.itemMode ?? descriptor.itemMode,
    concurrency:
      node.runtime?.concurrency ?? descriptor.defaults?.concurrency ?? 1,
  };
}

export function validateConfigLeniently(
  schema: z.ZodType<unknown>,
  config: Record<string, unknown>,
): Array<{ path: string; message: string }> {
  const parsed = schema.safeParse(config);
  if (parsed.success) return [];

  const issues: Array<{ path: string; message: string }> = [];
  for (const issue of parsed.error.issues) {
    const path = issue.path.map((segment) => String(segment)).join(".");
    if (valueAtPathIsExpression(config, issue.path)) continue;
    issues.push({ path, message: issue.message });
  }
  return issues;
}

function valueAtPathIsExpression(
  root: unknown,
  path: ReadonlyArray<PropertyKey>,
): boolean {
  let current: unknown = root;
  for (const segment of path) {
    if (current === null || current === undefined) return false;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return false;
      current = current[index];
      continue;
    }
    if (typeof current !== "object") return false;
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return typeof current === "string" && hasExpression(current);
}

export class ScenarioCompiler {
  constructor(private readonly registry: ScenarioDescriptorRegistry) {}

  validate(graph: ScenarioGraph): ScenarioValidationResult {
    const issues: ScenarioValidationIssue[] = [];
    const push = (...found: ScenarioValidationIssue[]): void => {
      for (const issue of found) if (issue) issues.push(issue);
    };

    if (graph?.version !== SCENARIO_GRAPH_VERSION) {
      push({
        severity: "error",
        message: `Граф в формате версии ${String(graph?.version ?? "1")}. Поддерживается только версия ${SCENARIO_GRAPH_VERSION} — пересоберите сценарий в редакторе.`,
      });
      return { valid: false, issues };
    }

    const nodes = graph.nodes ?? [];
    const edges = graph.edges ?? [];
    const byId = new Map(nodes.map((node) => [node.id, node]));

    if (nodes.length === 0) {
      push({ severity: "error", message: "Сценарий пуст" });
      return { valid: false, issues };
    }

    const seenNames = new Map<string, string>();
    const countByKind = new Map<string, number>();
    const portsCache = new Map<
      string,
      { inputs: PortSpec[]; outputs: PortSpec[] }
    >();

    for (const node of nodes) {
      if (!this.registry.has(node.kind)) {
        push({
          nodeId: node.id,
          severity: "error",
          message: `Неизвестный тип узла «${node.kind}»`,
        });
        continue;
      }
      const descriptor = this.registry.require(node.kind);
      countByKind.set(node.kind, (countByKind.get(node.kind) ?? 0) + 1);

      const name = node.name.trim();
      if (!name)
        push({
          nodeId: node.id,
          severity: "error",
          message: "У узла должно быть имя",
        });
      else if (seenNames.has(name))
        push({
          nodeId: node.id,
          severity: "error",
          message: `Имя «${name}» уже занято другим узлом. Имена адресуются из выражений и должны быть уникальны.`,
        });
      else seenNames.set(name, node.id);

      portsCache.set(node.id, {
        inputs: resolvePorts(descriptor.inputs, node.config),
        outputs: resolvePorts(descriptor.outputs, node.config),
      });

      for (const problem of validateConfigLeniently(
        descriptor.configSchema,
        node.config,
      ))
        push({
          nodeId: node.id,
          path: problem.path,
          severity: "error",
          message: problem.path
            ? `Настройка «${problem.path}»: ${problem.message}`
            : problem.message,
        });

      for (const problem of validateExpressions(node.config))
        push({
          nodeId: node.id,
          path: problem.path,
          severity: "error",
          message: `Выражение «${problem.source}»: ${problem.message}`,
        });
    }

    for (const [kind, count] of countByKind) {
      const limit = this.registry.get(kind)?.maxPerScenario;
      if (limit !== undefined && count > limit)
        push({
          severity: "error",
          message: `Узлов типа «${this.registry.require(kind).label}» может быть не больше ${limit}, а найдено ${count}`,
        });
    }

    const edgeCountByTargetPort = new Map<string, number>();
    const edgeCountBySourcePort = new Map<string, number>();

    for (const edge of edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) {
        push({
          edgeId: edge.id,
          severity: "error",
          message: "Связь ссылается на отсутствующий узел",
        });
        continue;
      }
      if (edge.source === edge.target) {
        push({
          edgeId: edge.id,
          nodeId: edge.source,
          severity: "error",
          message: "Узел не может ссылаться сам на себя",
        });
        continue;
      }

      const sourceDescriptor = this.registry.get(source.kind);
      const targetDescriptor = this.registry.get(target.kind);

      if (sourceDescriptor?.isTerminal) {
        push({
          edgeId: edge.id,
          nodeId: source.id,
          severity: "error",
          message: `Узел «${source.name}» завершает ветку и не может иметь исходящих связей`,
        });
        continue;
      }
      if (targetDescriptor?.isTrigger) {
        push({
          edgeId: edge.id,
          nodeId: target.id,
          severity: "error",
          message: `Триггер «${target.name}» не может иметь входящих связей`,
        });
        continue;
      }

      const sourcePorts = portsCache.get(source.id);
      const targetPorts = portsCache.get(target.id);
      if (!sourcePorts || !targetPorts) continue;

      const sourcePort = sourcePorts.outputs.find(
        (port) => port.id === edge.sourcePort,
      );
      const targetPort = targetPorts.inputs.find(
        (port) => port.id === edge.targetPort,
      );

      if (!sourcePort) {
        push({
          edgeId: edge.id,
          nodeId: source.id,
          severity: "error",
          message: `У узла «${source.name}» нет выхода «${edge.sourcePort}»`,
        });
        continue;
      }
      if (!targetPort) {
        push({
          edgeId: edge.id,
          nodeId: target.id,
          severity: "error",
          message: `У узла «${target.name}» нет входа «${edge.targetPort}»`,
        });
        continue;
      }
      if (sourcePort.dataKind !== targetPort.dataKind) {
        push({
          edgeId: edge.id,
          severity: "error",
          message: `Несовместимые порты: «${sourcePort.label}» отдаёт ${describeKind(sourcePort.dataKind)}, а «${targetPort.label}» ждёт ${describeKind(targetPort.dataKind)}`,
        });
        continue;
      }

      const targetKey = `${edge.target}:${edge.targetPort}`;
      const sourceKey = `${edge.source}:${edge.sourcePort}`;
      edgeCountByTargetPort.set(
        targetKey,
        (edgeCountByTargetPort.get(targetKey) ?? 0) + 1,
      );
      edgeCountBySourcePort.set(
        sourceKey,
        (edgeCountBySourcePort.get(sourceKey) ?? 0) + 1,
      );

      if (
        !targetPort.multiple &&
        (edgeCountByTargetPort.get(targetKey) ?? 0) > 1
      )
        push({
          edgeId: edge.id,
          nodeId: target.id,
          severity: "error",
          message: `Вход «${targetPort.label}» узла «${target.name}» принимает только одну связь`,
        });
      if (
        !sourcePort.multiple &&
        (edgeCountBySourcePort.get(sourceKey) ?? 0) > 1
      )
        push({
          edgeId: edge.id,
          nodeId: source.id,
          severity: "error",
          message: `Выход «${sourcePort.label}» узла «${source.name}» допускает только одну связь`,
        });
    }

    for (const node of nodes) {
      const descriptor = this.registry.get(node.kind);
      const ports = portsCache.get(node.id);
      if (!descriptor || !ports || descriptor.isTrigger) continue;
      for (const port of ports.inputs) {
        if (port.optional) continue;
        if ((edgeCountByTargetPort.get(`${node.id}:${port.id}`) ?? 0) === 0)
          push({
            nodeId: node.id,
            severity: "error",
            message: `Вход «${port.label}» узла «${node.name}» не подключён`,
          });
      }
    }

    const triggers = nodes.filter(
      (node) => this.registry.get(node.kind)?.isTrigger,
    );
    if (triggers.length === 0)
      push({ severity: "error", message: "В сценарии нет ни одного триггера" });

    const mainEdges = edges.filter((edge) => {
      const sourcePorts = portsCache.get(edge.source);
      const dataKind = sourcePorts?.outputs.find(
        (port) => port.id === edge.sourcePort,
      )?.dataKind;
      return dataKind !== undefined && FLOW_KINDS.has(dataKind);
    });
    const { backEdgeIds } = findBackEdges(
      nodes.map((node) => node.id),
      mainEdges,
      triggers.map((node) => node.id),
    );
    for (const edgeId of backEdgeIds) {
      const edge = edges.find((candidate) => candidate.id === edgeId);
      if (!edge) continue;
      const target = byId.get(edge.target);
      if (!target || this.registry.get(target.kind)?.allowsLoopBack) continue;
      push({
        edgeId,
        nodeId: edge.target,
        severity: "error",
        message: `Связь замыкает цикл на узле «${target.name}», который циклы не поддерживает. Замкните цикл на узел «Цикл по батчам».`,
      });
    }

    const reachable = computeReachable(
      triggers.map((node) => node.id),
      mainEdges,
    );
    for (const node of nodes) {
      const descriptor = this.registry.get(node.kind);
      if (!descriptor || descriptor.isTrigger) continue;
      const onlyKnowledge = portsCache
        .get(node.id)
        ?.outputs.every((port) => port.dataKind === "knowledge");
      if (onlyKnowledge) continue;
      if (!reachable.has(node.id))
        push({
          nodeId: node.id,
          severity: "warning",
          message: `Узел «${node.name}» недостижим ни из одного триггера и никогда не выполнится`,
        });
    }

    const knownNames = new Set(nodes.map((node) => node.name.trim()));
    for (const node of nodes)
      for (const reference of collectNodeReferences(node.config))
        if (!knownNames.has(reference))
          push({
            nodeId: node.id,
            severity: "warning",
            message: `Выражение ссылается на узел «${reference}», которого нет в сценарии`,
          });

    for (const node of nodes) {
      const descriptor = this.registry.get(node.kind);
      if (!descriptor?.validate) continue;
      const incoming = edges.filter((edge) => edge.target === node.id);
      const outgoing = edges.filter((edge) => edge.source === node.id);
      try {
        push(...descriptor.validate({ node, graph, incoming, outgoing }));
      } catch (error) {
        push({
          nodeId: node.id,
          severity: "error",
          message: `Проверка узла завершилась ошибкой: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const seenVariables = new Set<string>();
    for (const variable of graph.variables ?? []) {
      if (seenVariables.has(variable.key))
        push({
          severity: "error",
          message: `Переменная «${variable.key}» объявлена дважды`,
        });
      seenVariables.add(variable.key);
    }

    return {
      valid: !issues.some((issue) => issue.severity === "error"),
      issues,
    };
  }

  compile(graph: ScenarioGraph): CompiledScenario {
    const result = this.validate(graph);
    if (!result.valid)
      throw new PermanentError(
        result.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => issue.message)
          .join("; "),
        { code: "validation" },
      );

    const nodes = new Map<string, CompiledNode>();
    const outgoing = new Map<string, Map<string, ScenarioEdge[]>>();
    const incoming = new Map<string, Map<string, ScenarioEdge[]>>();
    const nodeIdByName = new Map<string, string>();
    const nameByNodeId = new Map<string, string>();

    for (const node of graph.nodes) {
      const descriptor = this.registry.require(node.kind);
      const inputs = resolvePorts(descriptor.inputs, node.config);
      const outputs = resolvePorts(descriptor.outputs, node.config);
      nodes.set(node.id, {
        node,
        descriptor,
        inputs,
        outputs,
        runtime: resolveRuntime(node, descriptor),
        requiredInputs: inputs
          .filter((port) => !port.optional)
          .map((port) => port.id),
      });
      nodeIdByName.set(node.name.trim(), node.id);
      nameByNodeId.set(node.id, node.name.trim());
      outgoing.set(node.id, new Map());
      incoming.set(node.id, new Map());
    }

    const appendEdge = (
      buckets: Map<string, Map<string, ScenarioEdge[]>>,
      nodeId: string,
      portId: string,
      edge: ScenarioEdge,
    ): void => {
      const ports = buckets.get(nodeId);
      if (!ports) return;
      const list = ports.get(portId);
      if (list) list.push(edge);
      else ports.set(portId, [edge]);
    };

    for (const edge of graph.edges) {
      appendEdge(outgoing, edge.source, edge.sourcePort, edge);
      appendEdge(incoming, edge.target, edge.targetPort, edge);
    }

    for (const edge of graph.edges) {
      const target = nodes.get(edge.target);
      if (!target || target.node.runtime?.onError !== undefined) continue;
      const port = nodes
        .get(edge.source)
        ?.outputs.find((candidate) => candidate.id === edge.sourcePort);
      if (port?.targetErrorMode)
        target.runtime = { ...target.runtime, onError: port.targetErrorMode };
    }

    const triggers = graph.nodes
      .filter((node) => nodes.get(node.id)!.descriptor.isTrigger)
      .map((node) => node.id);
    const mainEdges = graph.edges.filter((edge) => {
      const dataKind = nodes
        .get(edge.source)
        ?.outputs.find((port) => port.id === edge.sourcePort)?.dataKind;
      return dataKind !== undefined && FLOW_KINDS.has(dataKind);
    });
    const { backEdgeIds } = findBackEdges(
      [...nodes.keys()],
      mainEdges,
      triggers,
    );
    const order = topologicalOrder(
      [...nodes.keys()],
      mainEdges.filter((edge) => !backEdgeIds.has(edge.id)),
    );

    const variables: Record<string, unknown> = {};
    for (const variable of graph.variables ?? [])
      variables[variable.key] = variable.value;

    return {
      nodes,
      triggers,
      order,
      backEdgeIds,
      outgoing,
      incoming,
      nodeIdByName,
      nameByNodeId,
      variables,
      maxNodeExecutions: graph.maxNodeExecutions ?? 1_000,
    };
  }
}

function describeKind(kind: string): string {
  if (kind === "knowledge") return "контекст базы знаний";
  if (kind === "files") return "файлы";
  return "поток данных";
}

export function findBackEdges(
  nodeIds: string[],
  edges: ScenarioEdge[],
  roots: string[],
): { backEdgeIds: Set<string> } {
  const adjacency = new Map<string, ScenarioEdge[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge);

  const backEdgeIds = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>();

  const visit = (root: string): void => {
    const stack: Array<{ nodeId: string; cursor: number }> = [
      { nodeId: root, cursor: 0 },
    ];
    state.set(root, 1);
    while (stack.length) {
      const frame = stack[stack.length - 1]!;
      const edgesFromNode = adjacency.get(frame.nodeId) ?? [];
      if (frame.cursor >= edgesFromNode.length) {
        state.set(frame.nodeId, 2);
        stack.pop();
        continue;
      }
      const edge = edgesFromNode[frame.cursor++]!;
      const targetState = state.get(edge.target) ?? 0;
      if (targetState === 1) backEdgeIds.add(edge.id);
      else if (targetState === 0) {
        state.set(edge.target, 1);
        stack.push({ nodeId: edge.target, cursor: 0 });
      }
    }
  };

  for (const root of roots) if ((state.get(root) ?? 0) === 0) visit(root);
  for (const id of nodeIds) if ((state.get(id) ?? 0) === 0) visit(id);

  return { backEdgeIds };
}

export function computeReachable(
  roots: string[],
  edges: ScenarioEdge[],
): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }
  const reachable = new Set<string>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    stack.push(...(adjacency.get(id) ?? []));
  }
  return reachable;
}

export function topologicalOrder(
  nodeIds: string[],
  edges: ScenarioEdge[],
): string[] {
  const degree = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!degree.has(edge.target) || !degree.has(edge.source)) continue;
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }
  const queue = nodeIds.filter((id) => degree.get(id) === 0);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const target of adjacency.get(id) ?? []) {
      const next = (degree.get(target) ?? 0) - 1;
      degree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  const placed = new Set(order);
  for (const id of nodeIds)
    if (!placed.has(id)) {
      order.push(id);
      placed.add(id);
    }
  return order;
}

const NODE_REFERENCE = /\$node\s*\[\s*(['"`])(.*?)\1\s*\]/g;

export function collectNodeReferences(
  value: unknown,
  output = new Set<string>(),
): Set<string> {
  if (typeof value === "string") {
    for (const match of value.matchAll(NODE_REFERENCE))
      if (match[2]) output.add(match[2]);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNodeReferences(item, output);
    return output;
  }
  if (value !== null && typeof value === "object")
    for (const item of Object.values(value as Record<string, unknown>))
      collectNodeReferences(item, output);
  return output;
}
