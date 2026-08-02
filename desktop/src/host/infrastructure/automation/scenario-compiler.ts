import type {
  AutomationScenarioEdge,
  AutomationScenarioGraph,
  AutomationScenarioNode,
  ScenarioValidationResult,
} from "../../../ipc/contracts";

export interface CompiledScenario {
  controlOrder: string[];
  controlIncoming: Map<string, string[]>;
  workerLevelsByOrchestrator: Map<string, string[][]>;
  workerIncoming: Map<string, string[]>;
  workerTerminalIdsByOrchestrator: Map<string, string[]>;
  knowledgeStoreIdsByAgent: Map<string, number[]>;
}

export class ScenarioCompiler {
  validate(graph: AutomationScenarioGraph): ScenarioValidationResult {
    const issues: ScenarioValidationResult["issues"] = [];
    const nodes = graph?.nodes ?? [];
    const edges = graph?.edges ?? [];
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const triggers = nodes.filter((node) => node.kind === "trigger");
    const orchestrators = nodes.filter((node) => node.kind === "orchestrator");
    const outputs = nodes.filter((node) => node.kind === "output");
    const edgeKind = (edge: AutomationScenarioEdge) =>
      resolveEdgeKind(edge, byId);
    const controlEdges = edges.filter(
      (edge) =>
        edgeKind(edge) === "control" &&
        byId.get(edge.source)?.kind !== "agent" &&
        byId.get(edge.target)?.kind !== "agent",
    );
    const workerEdges = edges.filter((edge) => edgeKind(edge) === "worker");
    const workerIncomingCount = new Map<string, number>();
    for (const edge of workerEdges)
      workerIncomingCount.set(
        edge.target,
        (workerIncomingCount.get(edge.target) ?? 0) + 1,
      );

    if (triggers.length !== 1)
      issues.push({ message: "Сценарий должен содержать ровно один триггер" });
    if (orchestrators.length !== 1)
      issues.push({
        message: "Сценарий должен содержать ровно один оркестратор",
      });
    if (outputs.length === 0)
      issues.push({
        message: "Сценарий должен содержать хотя бы один результат",
      });

    for (const edge of edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) {
        issues.push({
          message: `Связь ${edge.id} ссылается на отсутствующий узел`,
        });
        continue;
      }
      if (edge.source === edge.target)
        issues.push({
          nodeId: edge.source,
          message: "Узел не может ссылаться сам на себя",
        });
      if (
        edgeKind(edge) === "knowledge" &&
        !(
          source.kind === "knowledge_store" &&
          target.kind === "agent" &&
          edge.sourcePort === "knowledge-out" &&
          edge.targetPort === "knowledge-in"
        )
      )
        issues.push({
          message: "Хранилище подключается только к knowledge-порту агента",
        });
      if (
        edgeKind(edge) === "worker" &&
        !(
          (source.kind === "orchestrator" || source.kind === "agent") &&
          target.kind === "agent" &&
          edge.sourcePort === "workers" &&
          edge.targetPort === "worker-in"
        )
      )
        issues.push({
          message:
            "Исполнительная связь допустима от оркестратора или агента к агенту",
        });
      if (
        edgeKind(edge) === "control" &&
        (source.kind === "agent" ||
          target.kind === "agent" ||
          source.kind === "knowledge_store" ||
          target.kind === "knowledge_store" ||
          edge.sourcePort !== "control-out" ||
          edge.targetPort !== "control-in")
      )
        issues.push({
          message:
            "Агент подключается только к исполнительному порту оркестратора",
        });
    }

    for (const node of nodes) {
      if (
        node.kind === "knowledge_store" &&
        (!Number.isInteger(Number(node.config?.vectorStoreId)) ||
          Number(node.config?.vectorStoreId) < 1)
      )
        issues.push({
          nodeId: node.id,
          message: `Для узла «${node.title}» не выбрано хранилище`,
        });
      if (node.kind === "agent" && !String(node.config?.agentId ?? "").trim())
        issues.push({
          nodeId: node.id,
          message: `Для узла «${node.title}» не выбран агент`,
        });
      if (
        node.kind === "agent" &&
        (workerIncomingCount.get(node.id) ?? 0) === 0
      )
        issues.push({
          nodeId: node.id,
          message: "Агент должен иметь входящую исполнительную связь",
        });
      if (
        node.kind === "trigger" &&
        controlEdges.some((edge) => edge.target === node.id)
      )
        issues.push({
          nodeId: node.id,
          message: "Триггер не может иметь входящих связей",
        });
      if (
        node.kind === "output" &&
        controlEdges.some((edge) => edge.source === node.id)
      )
        issues.push({
          nodeId: node.id,
          message: "Результат не может иметь исходящих связей",
        });
    }

    if (
      triggers[0] &&
      orchestrators[0] &&
      !controlEdges.some(
        (edge) =>
          edge.source === triggers[0]!.id &&
          edge.target === orchestrators[0]!.id,
      )
    )
      issues.push({
        message:
          "Триггер должен быть соединён с управляющим входом оркестратора",
      });
    if (
      orchestrators[0] &&
      !controlEdges.some(
        (edge) =>
          edge.source === orchestrators[0]!.id &&
          byId.get(edge.target)?.kind === "output",
      )
    )
      issues.push({
        message:
          "Управляющий выход оркестратора должен быть соединён с результатом",
      });

    const workerOutgoing = new Map(
      nodes
        .filter((node) => node.kind === "agent")
        .map((node) => [node.id, [] as string[]]),
    );
    for (const edge of workerEdges) {
      if (workerOutgoing.has(edge.source))
        workerOutgoing.get(edge.source)!.push(edge.target);
    }
    const agentDegree = new Map(
      nodes
        .filter((node) => node.kind === "agent")
        .map((node) => [node.id, 0]),
    );
    for (const edge of workerEdges)
      if (edge.source !== orchestrators[0]?.id && agentDegree.has(edge.target))
        agentDegree.set(edge.target, (agentDegree.get(edge.target) ?? 0) + 1);
    const agentQueue = [...agentDegree]
      .filter(([, degree]) => degree === 0)
      .map(([id]) => id);
    let visitedAgents = 0;
    while (agentQueue.length) {
      const id = agentQueue.shift()!;
      visitedAgents += 1;
      for (const target of workerOutgoing.get(id) ?? []) {
        const next = (agentDegree.get(target) ?? 0) - 1;
        agentDegree.set(target, next);
        if (next === 0) agentQueue.push(target);
      }
    }
    if (visitedAgents !== agentDegree.size)
      issues.push({ message: "Исполнительный граф содержит цикл" });

    const controlNodes = nodes.filter(
      (node) => node.kind !== "agent" && node.kind !== "knowledge_store",
    );
    const incoming = new Map(controlNodes.map((node) => [node.id, 0]));
    const outgoing = new Map(
      controlNodes.map((node) => [node.id, [] as string[]]),
    );
    for (const edge of controlEdges) {
      if (!incoming.has(edge.target) || !outgoing.has(edge.source)) continue;
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
      outgoing.get(edge.source)!.push(edge.target);
    }
    const queue = controlNodes
      .filter((node) => incoming.get(node.id) === 0)
      .map((node) => node.id);
    const visited: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      visited.push(id);
      for (const target of outgoing.get(id) ?? []) {
        const next = (incoming.get(target) ?? 0) - 1;
        incoming.set(target, next);
        if (next === 0) queue.push(target);
      }
    }
    if (visited.length !== controlNodes.length)
      issues.push({ message: "Управляющий граф содержит цикл" });

    if (triggers[0]) {
      const reachable = new Set<string>();
      const stack = [triggers[0].id];
      while (stack.length) {
        const id = stack.pop()!;
        if (reachable.has(id)) continue;
        reachable.add(id);
        stack.push(...(outgoing.get(id) ?? []));
      }
      for (const node of controlNodes)
        if (!reachable.has(node.id))
          issues.push({
            nodeId: node.id,
            message: "Управляющий узел недостижим из триггера",
          });
    }
    return { valid: issues.length === 0, issues };
  }

  compile(graph: AutomationScenarioGraph): CompiledScenario {
    const result = this.validate(graph);
    if (!result.valid)
      throw new Error(result.issues.map((issue) => issue.message).join("; "));
    const controlNodes = graph.nodes.filter(
      (node) => node.kind !== "agent" && node.kind !== "knowledge_store",
    );
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    const edgeKind = (edge: AutomationScenarioEdge) =>
      resolveEdgeKind(edge, byId);
    const controlEdges = graph.edges.filter(
      (edge) =>
        edgeKind(edge) === "control" &&
        byId.get(edge.source)?.kind !== "agent" &&
        byId.get(edge.target)?.kind !== "agent",
    );
    const controlIncoming = new Map(
      controlNodes.map((node) => [node.id, [] as string[]]),
    );
    const outgoing = new Map(
      controlNodes.map((node) => [node.id, [] as string[]]),
    );
    for (const edge of controlEdges) {
      controlIncoming.get(edge.target)!.push(edge.source);
      outgoing.get(edge.source)!.push(edge.target);
    }
    const degree = new Map(
      [...controlIncoming].map(([id, values]) => [id, values.length]),
    );
    const queue = controlNodes
      .filter((node) => degree.get(node.id) === 0)
      .map((node) => node.id);
    const controlOrder: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      controlOrder.push(id);
      for (const target of outgoing.get(id) ?? []) {
        const next = degree.get(target)! - 1;
        degree.set(target, next);
        if (next === 0) queue.push(target);
      }
    }
    const workerEdges = graph.edges.filter(
      (item) => edgeKind(item) === "worker",
    );
    const workerIncoming = new Map(
      graph.nodes
        .filter((node) => node.kind === "agent")
        .map((node) => [node.id, [] as string[]]),
    );
    const workerOutgoing = new Map(
      graph.nodes
        .filter((node) => node.kind === "agent")
        .map((node) => [node.id, [] as string[]]),
    );
    for (const edge of workerEdges) {
      if (byId.get(edge.source)?.kind === "agent")
        workerIncoming.get(edge.target)!.push(edge.source);
      if (byId.get(edge.source)?.kind === "agent")
        workerOutgoing.get(edge.source)!.push(edge.target);
    }
    const workerLevelsByOrchestrator = new Map<string, string[][]>();
    const workerTerminalIdsByOrchestrator = new Map<string, string[]>();
    const workerRootsByOrchestrator = new Map<string, string[]>();
    for (const edge of workerEdges)
      if (byId.get(edge.source)?.kind === "orchestrator") {
        const roots = workerRootsByOrchestrator.get(edge.source) ?? [];
        roots.push(edge.target);
        workerRootsByOrchestrator.set(edge.source, roots);
      }
    for (const orchestrator of graph.nodes.filter(
      (node) => node.kind === "orchestrator",
    )) {
      const reachable = new Set<string>();
      const stack = [...(workerRootsByOrchestrator.get(orchestrator.id) ?? [])];
      while (stack.length) {
        const id = stack.pop()!;
        if (reachable.has(id)) continue;
        reachable.add(id);
        stack.push(...(workerOutgoing.get(id) ?? []));
      }
      const degree = new Map(
        [...reachable].map((id) => [
          id,
          (workerIncoming.get(id) ?? []).filter((parent) =>
            reachable.has(parent),
          ).length,
        ]),
      );
      let level = [...degree]
        .filter(([, value]) => value === 0)
        .map(([id]) => id);
      const levels: string[][] = [];
      while (level.length) {
        levels.push(level);
        const nextLevel: string[] = [];
        for (const id of level)
          for (const target of workerOutgoing.get(id) ?? []) {
            if (!degree.has(target)) continue;
            const next = degree.get(target)! - 1;
            degree.set(target, next);
            if (next === 0) nextLevel.push(target);
          }
        level = nextLevel;
      }
      workerLevelsByOrchestrator.set(orchestrator.id, levels);
      workerTerminalIdsByOrchestrator.set(
        orchestrator.id,
        [...reachable].filter(
          (id) =>
            !(workerOutgoing.get(id) ?? []).some((target) =>
              reachable.has(target),
            ),
        ),
      );
    }
    const knowledgeStoreIdsByAgent = new Map(
      graph.nodes
        .filter((node) => node.kind === "agent")
        .map((node) => [node.id, [] as number[]]),
    );
    for (const edge of graph.edges) {
      if (edgeKind(edge) !== "knowledge") continue;
      const storeId = Number(byId.get(edge.source)?.config?.vectorStoreId);
      if (Number.isInteger(storeId) && storeId > 0)
        knowledgeStoreIdsByAgent.get(edge.target)?.push(storeId);
    }
    return {
      controlOrder,
      controlIncoming,
      workerLevelsByOrchestrator,
      workerIncoming,
      workerTerminalIdsByOrchestrator,
      knowledgeStoreIdsByAgent,
    };
  }
}

function resolveEdgeKind(
  edge: AutomationScenarioEdge,
  nodes: Map<string, AutomationScenarioNode>,
) {
  const sourceKind = nodes.get(edge.source)?.kind;
  if (
    sourceKind === "knowledge_store" &&
    nodes.get(edge.target)?.kind === "agent"
  )
    return "knowledge";
  return (sourceKind === "orchestrator" || sourceKind === "agent") &&
    nodes.get(edge.target)?.kind === "agent"
    ? "worker"
    : edge.kind;
}
