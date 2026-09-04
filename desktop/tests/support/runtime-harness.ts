import { ScenarioCompiler } from "../../src/shared/scenario/compiler";
import { scenarioDescriptors } from "../../src/shared/scenario/descriptors/index";
import type { ScenarioGraph } from "../../src/shared/scenario/graph";
import type { ScenarioItems } from "../../src/shared/scenario/items";
import type { NodeExecutor } from "../../src/shared/scenario/node-descriptor";
import { createNullLogger } from "../../src/host/infrastructure/observability/logger";
import {
  ScenarioRuntime,
  type RuntimeNodeEvent,
  type RuntimePersistence,
} from "../../src/host/infrastructure/automation/engine/runtime";
import type { SerializedSchedulerState } from "../../src/host/infrastructure/automation/engine/scheduler-state";
import { FLOW_EXECUTORS } from "../../src/host/infrastructure/automation/engine/executors/flow.executors";
import { DATA_EXECUTORS } from "../../src/host/infrastructure/automation/engine/executors/data.executors";

export interface NodeRunRecord {
  nodeRunId: string;
  nodeId: string;
  attempt: number;
  iteration: number;
  status?: string;
  error?: string;
  partialOutput?: string;
  outputs?: Record<string, ScenarioItems>;
}

export class MemoryPersistence implements RuntimePersistence {
  readonly runs: NodeRunRecord[] = [];
  checkpoint?: SerializedSchedulerState;
  readonly checkpoints: SerializedSchedulerState[] = [];
  readonly suspendedExecutionIds: string[] = [];
  readonly clearedExecutionIds: string[] = [];
  private nextId = 1;

  startNode(input: {
    nodeId: string;
    attempt: number;
    iteration: number;
  }): string {
    const nodeRunId = `019cba09-8f30-7000-8000-${String(this.nextId++).padStart(12, "0")}`;
    this.runs.push({
      nodeRunId,
      nodeId: input.nodeId,
      attempt: input.attempt,
      iteration: input.iteration,
    });
    return nodeRunId;
  }

  finishNode(input: {
    nodeRunId: string;
    status: string;
    outputs?: Record<string, ScenarioItems>;
    error?: string;
    partialOutput?: string;
  }): void {
    const record = this.runs.find(
      (entry) => entry.nodeRunId === input.nodeRunId,
    );
    if (!record) return;
    record.status = input.status;
    record.error = input.error;
    record.partialOutput = input.partialOutput;
    record.outputs = input.outputs;
  }

  saveCheckpoint(_executionId: string, state: SerializedSchedulerState): void {
    const snapshot = JSON.parse(
      JSON.stringify(state),
    ) as SerializedSchedulerState;
    this.checkpoint = snapshot;
    this.checkpoints.push(snapshot);
  }

  markSuspended(executionId: string): void {
    this.suspendedExecutionIds.push(executionId);
  }

  clearCheckpoint(executionId: string): void {
    this.checkpoint = undefined;
    this.clearedExecutionIds.push(executionId);
  }

  countFor(nodeId: string): number {
    return this.runs.filter((record) => record.nodeId === nodeId).length;
  }

  statusesFor(nodeId: string): string[] {
    return this.runs
      .filter((record) => record.nodeId === nodeId)
      .map((record) => record.status ?? "?");
  }
}

export interface HarnessResult {
  outputs: Record<string, unknown>;
  status: string;
  events: RuntimeNodeEvent[];
  persistence: MemoryPersistence;
  checkpoint?: SerializedSchedulerState;
  suspension?: { nodeId: string; questionId: string };
  executedNodes: number;
}

export async function runGraph(
  graph: ScenarioGraph,
  options: {
    input?: unknown;
    extraExecutors?: Array<NodeExecutor<never, never>>;
    checkpoint?: SerializedSchedulerState;
    persistence?: MemoryPersistence;
    signal?: AbortSignal;
  } = {},
): Promise<HarnessResult> {
  const compiler = new ScenarioCompiler(scenarioDescriptors);
  const compiled = compiler.compile(graph);
  const executors = new Map<string, NodeExecutor<never, never>>();
  for (const executor of [
    ...FLOW_EXECUTORS,
    ...DATA_EXECUTORS,
    ...(options.extraExecutors ?? []),
  ])
    executors.set(executor.kind, executor);

  const persistence = options.persistence ?? new MemoryPersistence();
  const events: RuntimeNodeEvent[] = [];

  const runtime = new ScenarioRuntime({
    executionId: "019cba09-8f30-7000-8000-000000000301",
    scenarioId: "019cba09-8f30-7000-8000-000000000302",
    scenarioRevisionId: "019cba09-8f30-7000-8000-000000000303",
    graph,
    compiled,
    input: options.input ?? { trigger: "manual" },
    signal: options.signal ?? new AbortController().signal,
    logger: createNullLogger(),
    services: {},
    executors,
    persistence,
    emit: (event) => events.push(event),
    checkpoint: options.checkpoint,
  });

  const result = await runtime.run();
  return {
    outputs: result.outputs,
    status: result.status,
    events,
    persistence,
    checkpoint: result.checkpoint,
    suspension: result.suspension,
    executedNodes: result.executedNodes,
  };
}

export function spyExecutor(
  kind: string,
  behaviour: (context: {
    items: ScenarioItems;
    attempt: number;
    iteration: number;
    calls: number;
  }) => ScenarioItems | Promise<ScenarioItems> | never,
): NodeExecutor<never, never> & { calls: number } {
  const executor = {
    kind,
    calls: 0,
    async execute(context: {
      items: ScenarioItems;
      attempt: number;
      iteration: number;
      stream(delta: string): void;
    }) {
      executor.calls += 1;
      const items = await behaviour({
        items: context.items,
        attempt: context.attempt,
        iteration: context.iteration,
        calls: executor.calls,
      });
      return { items };
    },
  };
  return executor as unknown as NodeExecutor<never, never> & { calls: number };
}
