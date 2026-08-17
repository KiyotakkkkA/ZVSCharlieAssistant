import type { CompiledScenario } from "../../../../shared/scenario/compiler";
import type { ScenarioItems } from "../../../../shared/scenario/items";

export type EdgeState = "pending" | "delivered" | "dead";

export interface SerializedSchedulerState {
  version: 1;
  queue: string[];
  edges: Record<string, EdgeState>;
  buffers: Record<string, Record<string, ScenarioItems>>;
  executions: Record<string, number>;
  nodeOutputs: Record<string, unknown>;
  nodeState: Record<string, unknown>;
  totalExecutions: number;
  suspendedNodeId?: string;
  suspendedInputs?: Record<string, ScenarioItems>;
}

export class SchedulerState {
  readonly queue: string[] = [];
  private readonly edges = new Map<string, EdgeState>();
  private readonly buffers = new Map<string, Map<string, ScenarioItems>>();
  private readonly executions = new Map<string, number>();
  private readonly nodeState = new Map<string, unknown>();
  readonly nodeOutputs: Record<string, unknown> = {};
  totalExecutions = 0;
  suspendedNodeId?: string;
  suspendedInputs?: Record<string, ScenarioItems>;

  constructor(private readonly compiled: CompiledScenario) {}

  edgeState(edgeId: string): EdgeState {
    return this.edges.get(edgeId) ?? "pending";
  }

  setEdgeState(edgeId: string, state: EdgeState): void {
    this.edges.set(edgeId, state);
  }

  resetIncomingEdges(nodeId: string): void {
    for (const edges of this.compiled.incoming.get(nodeId)?.values() ?? [])
      for (const edge of edges) this.edges.set(edge.id, "pending");
  }

  deliver(nodeId: string, portId: string, items: ScenarioItems): void {
    const ports = this.buffers.get(nodeId) ?? new Map<string, ScenarioItems>();
    ports.set(portId, [...(ports.get(portId) ?? []), ...items]);
    this.buffers.set(nodeId, ports);
  }

  consume(nodeId: string): Record<string, ScenarioItems> {
    const ports = this.buffers.get(nodeId);
    this.buffers.delete(nodeId);
    if (!ports) return {};
    return Object.fromEntries(ports.entries());
  }

  peek(nodeId: string): Record<string, ScenarioItems> {
    const ports = this.buffers.get(nodeId);
    return ports ? Object.fromEntries(ports.entries()) : {};
  }

  executionsOf(nodeId: string): number {
    return this.executions.get(nodeId) ?? 0;
  }

  noteExecution(nodeId: string): number {
    const next = this.executionsOf(nodeId) + 1;
    this.executions.set(nodeId, next);
    this.totalExecutions += 1;
    return next;
  }

  getNodeState<T>(nodeId: string, initial: () => T): T {
    if (!this.nodeState.has(nodeId)) this.nodeState.set(nodeId, initial());
    return this.nodeState.get(nodeId) as T;
  }

  setNodeState(nodeId: string, value: unknown): void {
    this.nodeState.set(nodeId, value);
  }

  enqueue(nodeId: string): void {
    if (!this.queue.includes(nodeId)) this.queue.push(nodeId);
  }

  dequeue(): string | undefined {
    return this.queue.shift();
  }

  serialize(): SerializedSchedulerState {
    return {
      version: 1,
      queue: [...this.queue],
      edges: Object.fromEntries(this.edges.entries()),
      buffers: Object.fromEntries(
        [...this.buffers.entries()].map(([nodeId, ports]) => [
          nodeId,
          Object.fromEntries(ports.entries()),
        ]),
      ),
      executions: Object.fromEntries(this.executions.entries()),
      nodeOutputs: this.nodeOutputs,
      nodeState: Object.fromEntries(this.nodeState.entries()),
      totalExecutions: this.totalExecutions,
      suspendedNodeId: this.suspendedNodeId,
      suspendedInputs: this.suspendedInputs,
    };
  }

  static restore(
    compiled: CompiledScenario,
    snapshot: SerializedSchedulerState,
  ): SchedulerState {
    const state = new SchedulerState(compiled);
    state.queue.push(...(snapshot.queue ?? []));
    for (const [edgeId, edgeState] of Object.entries(snapshot.edges ?? {}))
      state.edges.set(edgeId, edgeState);
    for (const [nodeId, ports] of Object.entries(snapshot.buffers ?? {})) {
      const map = new Map<string, ScenarioItems>();
      for (const [portId, items] of Object.entries(ports))
        map.set(portId, items);
      state.buffers.set(nodeId, map);
    }
    for (const [nodeId, count] of Object.entries(snapshot.executions ?? {}))
      state.executions.set(nodeId, count);
    for (const [nodeId, value] of Object.entries(snapshot.nodeState ?? {}))
      state.nodeState.set(nodeId, value);
    Object.assign(state.nodeOutputs, snapshot.nodeOutputs ?? {});
    state.totalExecutions = snapshot.totalExecutions ?? 0;
    state.suspendedNodeId = snapshot.suspendedNodeId;
    state.suspendedInputs = snapshot.suspendedInputs;
    return state;
  }
}
