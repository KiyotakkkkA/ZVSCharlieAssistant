import type { ExpressionScope } from "../../../../shared/expressions";
import {
  ExpressionEvaluationError,
  resolveDeep,
} from "../../../../shared/expressions";
import type {
  CompiledNode,
  CompiledScenario,
} from "../../../../shared/scenario/compiler";
import {
  CancelledError,
  NodeTimeoutError,
  PermanentError,
  ScenarioSuspended,
  errorMessageOf,
  isCancellation,
  isRetryable,
  toScenarioError,
} from "../../../../shared/scenario/errors";
import type { ScenarioGraph } from "../../../../shared/scenario/graph";
import {
  ERROR_PORT,
  MAIN_PORT,
  concatItems,
  markItemsFailed,
  toItems,
  type ScenarioBinaryRef,
  type ScenarioItems,
} from "../../../../shared/scenario/items";
import type {
  NodeExecutionContext,
  NodeExecutor,
  NodeOutput,
} from "../../../../shared/scenario/node-descriptor";
import { METRIC, metrics } from "../../observability/metrics";
import type { Logger } from "../../observability/logger";
import {
  SchedulerState,
  type SerializedSchedulerState,
} from "./scheduler-state";

export interface RuntimeNodeEvent {
  type:
    | "node.started"
    | "node.completed"
    | "node.failed"
    | "node.skipped"
    | "node.retrying"
    | "node.output.delta";
  nodeId: string;
  nodeRunId?: string;
  attempt?: number;
  iteration?: number;
  status?: string;
  durationMs?: number;
  error?: string;
  delta?: string;
  itemsIn?: number;
  itemsOut?: number;
  diagnostics?: Record<string, unknown>;
}

export interface RuntimePersistence {
  startNode(input: {
    executionId: string;
    nodeId: string;
    nodeKind: string;
    attempt: number;
    iteration: number;
    inputs: Record<string, ScenarioItems>;
  }): Promise<string> | string;
  finishNode(input: {
    nodeRunId: string;
    status:
      "completed" | "failed" | "cancelled" | "skipped" | "waiting_for_approval";
    outputs?: Record<string, ScenarioItems>;
    error?: string;
    errorCode?: string;
    partialOutput?: string;
    diagnostics?: Record<string, unknown>;
    durationMs?: number;
  }): Promise<void> | void;
  saveCheckpoint(
    executionId: string,
    state: SerializedSchedulerState,
  ): Promise<void> | void;
}

export interface RunRuntimeOptions {
  executionId: string;
  scenarioId: string;
  scenarioRevisionId: string;
  graph: ScenarioGraph;
  compiled: CompiledScenario;
  input: unknown;
  signal: AbortSignal;
  logger: Logger;
  services: unknown;
  executors: Map<string, NodeExecutor<never, never>>;
  persistence: RuntimePersistence;
  emit(event: RuntimeNodeEvent): void;
  checkpoint?: SerializedSchedulerState;
  resumeAnswer?: unknown;
  onBinary?(ref: ScenarioBinaryRef): void;
}

export interface RunRuntimeResult {
  status: "completed" | "suspended";
  outputs: Record<string, unknown>;
  checkpoint?: SerializedSchedulerState;
  suspension?: { nodeId: string; questionId: string };
  executedNodes: number;
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

export class ScenarioRuntime {
  private readonly state: SchedulerState;
  private readonly compiled: CompiledScenario;
  private readonly trackedBinary: ScenarioBinaryRef[] = [];

  constructor(private readonly options: RunRuntimeOptions) {
    this.compiled = options.compiled;
    this.state = options.checkpoint
      ? SchedulerState.restore(options.compiled, options.checkpoint)
      : new SchedulerState(options.compiled);
  }

  async run(): Promise<RunRuntimeResult> {
    if (!this.options.checkpoint) this.seedTriggers();
    else this.resumeFromCheckpoint();

    const { compiled, signal, logger } = this.options;

    while (this.state.queue.length > 0) {
      if (signal.aborted) throw new CancelledError();
      if (this.state.totalExecutions >= compiled.maxNodeExecutions)
        throw new PermanentError(
          `Превышен лимит в ${compiled.maxNodeExecutions} исполнений узлов за один запуск. Скорее всего, цикл не завершается.`,
          { code: "validation" },
        );

      const nodeId = this.state.dequeue()!;
      const compiledNode = compiled.nodes.get(nodeId);
      if (!compiledNode) continue;

      const inputs = this.state.consume(nodeId);
      const result = await this.runNode(compiledNode, inputs);

      if (result.kind === "suspended") {
        this.state.suspendedNodeId = nodeId;
        this.state.suspendedInputs = inputs;
        this.state.enqueue(nodeId);
        const checkpoint = this.state.serialize();
        await this.options.persistence.saveCheckpoint(
          this.options.executionId,
          checkpoint,
        );
        logger.info("scenario.run.suspended", {
          nodeId,
          questionId: result.questionId,
        });
        return {
          status: "suspended",
          outputs: this.collectOutputs(),
          checkpoint,
          suspension: { nodeId, questionId: result.questionId },
          executedNodes: this.state.totalExecutions,
        };
      }

      this.propagate(compiledNode, result.outputs);
    }

    return {
      status: "completed",
      outputs: this.collectOutputs(),
      executedNodes: this.state.totalExecutions,
    };
  }

  get binaries(): ScenarioBinaryRef[] {
    return this.trackedBinary;
  }

  private seedTriggers(): void {
    const seed = toItems(this.options.input);
    for (const triggerId of this.compiled.triggers) {
      this.state.deliver(
        triggerId,
        MAIN_PORT,
        seed.length ? seed : [{ json: this.options.input ?? null }],
      );
      this.state.enqueue(triggerId);
    }
    if (this.compiled.triggers.length === 0)
      throw new PermanentError("В сценарии нет триггеров", {
        code: "validation",
      });
  }

  private resumeFromCheckpoint(): void {
    const nodeId = this.state.suspendedNodeId;
    if (!nodeId) return;
    for (const [portId, items] of Object.entries(
      this.state.suspendedInputs ?? {},
    ))
      this.state.deliver(nodeId, portId, items);
    this.state.suspendedNodeId = undefined;
    this.state.suspendedInputs = undefined;
    this.state.enqueue(nodeId);
  }

  private async runNode(
    compiledNode: CompiledNode,
    inputs: Record<string, ScenarioItems>,
  ): Promise<
    | { kind: "done"; outputs: Record<string, ScenarioItems> }
    | { kind: "suspended"; questionId: string }
  > {
    const { node, runtime } = compiledNode;
    const iteration = this.state.noteExecution(node.id);
    const mainItems = inputs[MAIN_PORT] ?? [];

    if (node.disabled) {
      this.options.emit({
        type: "node.skipped",
        nodeId: node.id,
        iteration,
        status: "disabled",
      });
      return { kind: "done", outputs: { [MAIN_PORT]: mainItems } };
    }

    const executor = this.options.executors.get(node.kind);
    if (!executor)
      throw new PermanentError(
        `Для узла «${node.name}» нет исполнителя типа «${node.kind}»`,
        {
          code: "config",
          context: { nodeId: node.id },
        },
      );

    const logger = this.options.logger.child({
      nodeId: node.id,
      nodeName: node.name,
      nodeKind: node.kind,
    });
    let lastError: unknown;

    for (let attempt = 1; attempt <= runtime.retry.maxTries; attempt++) {
      if (this.options.signal.aborted) throw new CancelledError();

      const startedAt = performance.now();
      const nodeRunId = await this.options.persistence.startNode({
        executionId: this.options.executionId,
        nodeId: node.id,
        nodeKind: node.kind,
        attempt,
        iteration,
        inputs,
      });
      this.options.emit({
        type: "node.started",
        nodeId: node.id,
        nodeRunId,
        attempt,
        iteration,
        itemsIn: mainItems.length,
      });

      let partial = "";
      try {
        const output = await this.executeWithTimeout(
          compiledNode,
          executor,
          inputs,
          { nodeRunId, attempt, iteration, logger },
          (delta) => {
            partial += delta;
            this.options.emit({
              type: "node.output.delta",
              nodeId: node.id,
              nodeRunId,
              delta,
            });
          },
        );

        const outputs = normalizeOutputs(output);
        const durationMs = Math.round(performance.now() - startedAt);
        await this.options.persistence.finishNode({
          nodeRunId,
          status: "completed",
          outputs,
          diagnostics: output.diagnostics,
          durationMs,
        });
        metrics.observe(METRIC.nodeDuration, durationMs, { kind: node.kind });
        metrics.increment(METRIC.nodeFinished, {
          kind: node.kind,
          status: "completed",
        });
        this.options.emit({
          type: "node.completed",
          nodeId: node.id,
          nodeRunId,
          attempt,
          iteration,
          durationMs,
          itemsIn: mainItems.length,
          itemsOut: Object.values(outputs).reduce(
            (total, items) => total + items.length,
            0,
          ),
          diagnostics: output.diagnostics,
        });
        this.recordNodeOutput(compiledNode, outputs);
        return { kind: "done", outputs };
      } catch (error) {
        const durationMs = Math.round(performance.now() - startedAt);

        if (error instanceof ScenarioSuspended) {
          await this.options.persistence.finishNode({
            nodeRunId,
            status: "waiting_for_approval",
            durationMs,
          });
          return { kind: "suspended", questionId: error.questionId };
        }

        if (isCancellation(error) || this.options.signal.aborted) {
          await this.options.persistence.finishNode({
            nodeRunId,
            status: "cancelled",
            error: "Выполнение отменено",
            durationMs,
            partialOutput: partial || undefined,
          });
          throw new CancelledError();
        }

        lastError = error;
        const scenarioError = toScenarioError(error, {
          nodeId: node.id,
          attempt,
        });
        const canRetry = attempt < runtime.retry.maxTries && isRetryable(error);

        await this.options.persistence.finishNode({
          nodeRunId,
          status: "failed",
          error: scenarioError.message,
          errorCode: scenarioError.code,
          partialOutput: partial || undefined,
          durationMs,
        });
        metrics.increment(METRIC.nodeFinished, {
          kind: node.kind,
          status: "failed",
        });
        this.options.emit({
          type: "node.failed",
          nodeId: node.id,
          nodeRunId,
          attempt,
          iteration,
          durationMs,
          error: scenarioError.message,
        });
        logger.warn("scenario.node.failed", {
          attempt,
          retryable: scenarioError.retryable,
          willRetry: canRetry,
          code: scenarioError.code,
          error: scenarioError.message,
        });

        if (!canRetry) break;

        metrics.increment(METRIC.nodeRetry, { kind: node.kind });
        const delay = Math.min(
          runtime.retry.maxBackoffMs,
          Math.round(
            runtime.retry.backoffMs *
              runtime.retry.backoffFactor ** (attempt - 1),
          ),
        );
        this.options.emit({
          type: "node.retrying",
          nodeId: node.id,
          attempt,
          iteration,
        });
        await sleep(delay, this.options.signal);
      }
    }

    return this.handleNodeFailure(compiledNode, inputs, lastError);
  }

  private handleNodeFailure(
    compiledNode: CompiledNode,
    inputs: Record<string, ScenarioItems>,
    error: unknown,
  ): { kind: "done"; outputs: Record<string, ScenarioItems> } {
    const { node, runtime } = compiledNode;
    const message = errorMessageOf(error);
    const failedItems = markItemsFailed(inputs[MAIN_PORT] ?? [{ json: null }], {
      message,
      nodeId: node.id,
    });

    if (runtime.onError === "continue") {
      this.options.logger.warn("scenario.node.continue_on_error", {
        nodeId: node.id,
        error: message,
      });
      return { kind: "done", outputs: { [MAIN_PORT]: failedItems } };
    }

    if (runtime.onError === "errorOutput") {
      const hasErrorPort = compiledNode.outputs.some(
        (port) => port.id === ERROR_PORT,
      );
      if (hasErrorPort) {
        this.options.logger.warn("scenario.node.error_output", {
          nodeId: node.id,
          error: message,
        });
        return { kind: "done", outputs: { [ERROR_PORT]: failedItems } };
      }
    }

    throw toScenarioError(error, { nodeId: node.id, nodeName: node.name });
  }

  private async executeWithTimeout(
    compiledNode: CompiledNode,
    executor: NodeExecutor<never, never>,
    inputs: Record<string, ScenarioItems>,
    meta: {
      nodeRunId: string;
      attempt: number;
      iteration: number;
      logger: Logger;
    },
    stream: (delta: string) => void,
  ): Promise<NodeOutput> {
    const { runtime } = compiledNode;
    const timeoutSignal = AbortSignal.timeout(runtime.timeoutSeconds * 1_000);
    const signal = AbortSignal.any([this.options.signal, timeoutSignal]);

    const execute = async (): Promise<NodeOutput> => {
      if (runtime.itemMode === "each")
        return this.executeEachItem(
          compiledNode,
          executor,
          inputs,
          meta,
          stream,
          signal,
        );
      const context = this.createContext(
        compiledNode,
        inputs,
        meta,
        stream,
        signal,
        undefined,
      );
      return executor.execute(context as never);
    };

    try {
      return await execute();
    } catch (error) {
      if (timeoutSignal.aborted && !this.options.signal.aborted)
        throw new NodeTimeoutError(
          `Узел «${compiledNode.node.name}» не уложился в ${runtime.timeoutSeconds} с`,
          { nodeId: compiledNode.node.id },
        );
      throw error;
    }
  }

  private async executeEachItem(
    compiledNode: CompiledNode,
    executor: NodeExecutor<never, never>,
    inputs: Record<string, ScenarioItems>,
    meta: {
      nodeRunId: string;
      attempt: number;
      iteration: number;
      logger: Logger;
    },
    stream: (delta: string) => void,
    signal: AbortSignal,
  ): Promise<NodeOutput> {
    const items = inputs[MAIN_PORT] ?? [];
    if (items.length === 0) return { outputs: {} };

    const concurrency = Math.max(
      1,
      Math.min(compiledNode.runtime.concurrency, items.length),
    );
    const collected: Array<Record<string, ScenarioItems>> = new Array(
      items.length,
    );
    const diagnostics: Record<string, unknown>[] = [];
    let cursor = 0;

    const worker = async (): Promise<void> => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        if (signal.aborted) throw new CancelledError();
        const context = this.createContext(
          compiledNode,
          { ...inputs, [MAIN_PORT]: [items[index]!] },
          meta,
          stream,
          signal,
          { localIndex: 0, reportedIndex: index },
        );
        const output = await executor.execute(context as never);
        const normalized = normalizeOutputs(output);
        for (const portItems of Object.values(normalized))
          for (const item of portItems)
            if (item.pairedItem === undefined) item.pairedItem = index;
        collected[index] = normalized;
        if (output.diagnostics) diagnostics.push(output.diagnostics);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const merged: Record<string, ScenarioItems> = {};
    for (const perItem of collected)
      for (const [portId, portItems] of Object.entries(perItem ?? {}))
        merged[portId] = concatItems(merged[portId] ?? [], portItems);

    return {
      outputs: merged,
      diagnostics: diagnostics.length ? { perItem: diagnostics } : undefined,
    };
  }

  private createContext(
    compiledNode: CompiledNode,
    inputs: Record<string, ScenarioItems>,
    meta: {
      nodeRunId: string;
      attempt: number;
      iteration: number;
      logger: Logger;
    },
    stream: (delta: string) => void,
    signal: AbortSignal,
    position: { localIndex: number; reportedIndex: number } | undefined,
  ): NodeExecutionContext<unknown, unknown> {
    const { node, descriptor } = compiledNode;
    const items = inputs[MAIN_PORT] ?? [];

    const scope = (index?: number): ExpressionScope => {
      const localIndex = index ?? position?.localIndex ?? 0;
      const reportedIndex = index ?? position?.reportedIndex ?? 0;
      const current = items[localIndex];
      return {
        $json: current?.json,
        $item: current,
        $index: reportedIndex,
        $items: items.map((item) => item.json),
        $binary: current?.binary,
        $node: this.state.nodeOutputs,
        $trigger: this.options.input,
        $vars: this.compiled.variables,
        $run: {
          id: this.options.executionId,
          scenarioId: this.options.scenarioId,
          attempt: meta.attempt,
          iteration: meta.iteration,
        },
      };
    };

    let config: unknown;
    try {
      const resolved = resolveDeep(node.config, {
        scope: scope(),
        onError: "throw",
      });
      const parsed = descriptor.configSchema.safeParse(resolved);
      if (!parsed.success)
        throw new PermanentError(
          `Настройки узла «${node.name}» некорректны: ${parsed.error.issues
            .map(
              (issue) =>
                `${issue.path.join(".") || "значение"} — ${issue.message}`,
            )
            .join("; ")}`,
          { code: "config", context: { nodeId: node.id } },
        );
      config = parsed.data;
    } catch (error) {
      if (error instanceof ExpressionEvaluationError)
        throw new PermanentError(`Узел «${node.name}»: ${error.message}`, {
          code: "expression",
          cause: error,
          context: { nodeId: node.id },
        });
      throw error;
    }

    return {
      node,
      config,
      rawConfig: node.config,
      items,
      inputs,
      executionId: this.options.executionId,
      nodeRunId: meta.nodeRunId,
      attempt: meta.attempt,
      iteration: meta.iteration,
      scenarioId: this.options.scenarioId,
      scenarioRevisionId: this.options.scenarioRevisionId,
      graph: this.options.graph,
      signal,
      logger: meta.logger,
      services: this.options.services,
      scope,
      stream,
      trackBinary: (ref) => {
        this.trackedBinary.push(ref);
        this.options.onBinary?.(ref);
      },
      state: <T>(initial: () => T) => ({
        get: () => this.state.getNodeState(node.id, initial),
        set: (value: T) => this.state.setNodeState(node.id, value),
      }),
    };
  }

  private recordNodeOutput(
    compiledNode: CompiledNode,
    outputs: Record<string, ScenarioItems>,
  ): void {
    const name = this.compiled.nameByNodeId.get(compiledNode.node.id);
    if (!name) return;
    const main = outputs[MAIN_PORT] ?? Object.values(outputs)[0] ?? [];
    this.state.nodeOutputs[name] = {
      json: main[0]?.json ?? null,
      items: main.map((item) => item.json),
      count: main.length,
    };
  }

  private propagate(
    compiledNode: CompiledNode,
    outputs: Record<string, ScenarioItems>,
  ): void {
    const touched = new Set<string>();
    const loopBack = new Set<string>();
    const outgoing = this.compiled.outgoing.get(compiledNode.node.id);

    for (const port of compiledNode.outputs) {
      const edges = outgoing?.get(port.id) ?? [];
      if (edges.length === 0) continue;
      const items = outputs[port.id] ?? [];
      for (const edge of edges) {
        if (items.length > 0) {
          this.state.deliver(edge.target, edge.targetPort, items);
          this.state.setEdgeState(edge.id, "delivered");
          if (this.compiled.backEdgeIds.has(edge.id)) loopBack.add(edge.target);
        } else this.state.setEdgeState(edge.id, "dead");
        touched.add(edge.target);
      }
    }

    for (const nodeId of loopBack) {
      touched.delete(nodeId);
      this.state.enqueue(nodeId);
    }

    const cascade = [...touched];
    const visited = new Set<string>();
    while (cascade.length) {
      const nodeId = cascade.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const target = this.compiled.nodes.get(nodeId);
      if (!target) continue;

      const status = this.readiness(target);
      if (status === "ready") {
        this.state.enqueue(nodeId);
        this.state.resetIncomingEdges(nodeId);
      } else if (status === "dead") {
        this.options.emit({
          type: "node.skipped",
          nodeId,
          status: "branch_not_taken",
        });
        for (const edges of this.compiled.outgoing.get(nodeId)?.values() ?? [])
          for (const edge of edges) {
            this.state.setEdgeState(edge.id, "dead");
            cascade.push(edge.target);
          }
      }
    }
  }

  private readiness(compiledNode: CompiledNode): "ready" | "waiting" | "dead" {
    const incoming = this.compiled.incoming.get(compiledNode.node.id);
    if (!incoming) return "waiting";

    let anyDelivered = false;
    let anyPending = false;
    let requiredWithEdges = 0;
    let requiredDead = 0;

    for (const port of compiledNode.inputs) {
      const edges = (incoming.get(port.id) ?? []).filter(
        (edge) => !this.compiled.backEdgeIds.has(edge.id),
      );
      if (edges.length === 0) continue;

      const states = edges.map((edge) => this.state.edgeState(edge.id));
      const delivered = states.includes("delivered");
      const pending = states.includes("pending");
      if (delivered) anyDelivered = true;
      if (pending) anyPending = true;

      if (!port.optional) {
        requiredWithEdges += 1;
        if (pending) return "waiting";
        if (!delivered) requiredDead += 1;
      }
    }

    if (requiredWithEdges > 0 && requiredDead === requiredWithEdges)
      return "dead";
    if (anyDelivered) return "ready";
    return anyPending ? "waiting" : "dead";
  }

  private collectOutputs(): Record<string, unknown> {
    return { ...this.state.nodeOutputs };
  }
}

function normalizeOutputs(output: NodeOutput): Record<string, ScenarioItems> {
  if (output.outputs) return output.outputs;
  if (output.items) return { [MAIN_PORT]: output.items };
  return {};
}
