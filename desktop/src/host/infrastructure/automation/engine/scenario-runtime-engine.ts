import type { Logger } from "../../observability/logger";
import type {
  ScenarioRun,
  ScenarioRunEvent,
  ScenarioRunOrigin,
} from "../../../../shared/models/automation";
import {
  ScenarioCompiler,
  type CompiledScenario,
} from "../../../../shared/scenario/compiler";
import { scenarioDescriptors } from "../../../../shared/scenario/descriptors";
import type { ScenarioGraph } from "../../../../shared/scenario/graph";
import type { NodeExecutor } from "../../../../shared/scenario/node-descriptor";
import type { ScenarioExecutionRepository } from "../../database/scenario-execution.repository";
import type { ScenarioGraphRepository } from "../../database/scenario-graph.repository";
import type { SqliteRuntimePersistence } from "./sqlite-runtime-persistence";
import type { SerializedSchedulerState } from "./scheduler-state";
import { ScenarioRuntime, type RuntimeNodeEvent } from "./runtime";
import type { ScenarioEngineServices } from "./services";
import type { UserQuestionService } from "../../../application/services/user-question.service";

type Emit = (event: ScenarioRunEvent) => void;

export class ScenarioRuntimeEngine {
  private readonly compiler = new ScenarioCompiler(scenarioDescriptors);
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly graphs: ScenarioGraphRepository,
    private readonly executions: ScenarioExecutionRepository,
    private readonly persistence: SqliteRuntimePersistence,
    private readonly services: ScenarioEngineServices,
    private readonly executors: Map<string, NodeExecutor<never, never>>,
    private readonly logger: Logger,
    private readonly questions?: UserQuestionService,
    private readonly eventObserver?: Emit,
  ) {}

  assertRunnable(scenarioId: string): void {
    const definition = this.graphs.find(scenarioId);
    if (!definition) throw new Error("Сценарий не найден");
    if (definition.status === "disabled") throw new Error("Сценарий отключён");
  }

  start(
    scenarioId: string,
    input: unknown,
    origin: ScenarioRunOrigin,
    emit: Emit,
    conversationId?: string,
    revisionId?: string,
  ): ScenarioRun {
    const publish = this.observe(emit);
    const definition = this.graphs.find(scenarioId, revisionId);
    if (!definition)
      throw new Error("Сценарий или его сохранённая ревизия не найдены");
    if (origin !== "background" && definition.status === "disabled")
      throw new Error("Сценарий отключён");
    const compiled = this.compiler.compile(definition.graph);
    const run = this.executions.createRun(
      scenarioId,
      definition.revisionId,
      origin,
      input,
      conversationId,
    );
    const controller = new AbortController();
    this.controllers.set(run.id, controller);
    publish({ type: "run.started", run });
    void this.execute(
      run.id,
      scenarioId,
      definition.revisionId,
      definition.graph,
      compiled,
      input,
      controller,
      publish,
    );
    return run;
  }

  resume(executionId: string, emit: Emit): void {
    const publish = this.observe(emit);
    const run = this.executions.run(executionId);
    if (!run) throw new Error("Запуск не найден");
    const definition = this.graphs.find(run.scenarioId, run.scenarioRevisionId);
    if (!definition) throw new Error("Сценарий или его ревизия не найдены");
    const checkpoint = this.persistence.loadCheckpoint(executionId);
    if (!checkpoint) throw new Error("У запуска нет сохранённого чекпойнта");
    const compiled = this.compiler.compile(definition.graph);
    const controller = new AbortController();
    this.controllers.set(executionId, controller);
    void this.execute(
      executionId,
      run.scenarioId,
      run.scenarioRevisionId,
      definition.graph,
      compiled,
      run.input,
      controller,
      publish,
      checkpoint,
    );
  }

  cancel(runId: string): void {
    this.controllers.get(runId)?.abort();
  }

  private observe(emit: Emit): Emit {
    return (event) => {
      this.eventObserver?.(event);
      emit(event);
    };
  }

  private async execute(
    runId: string,
    scenarioId: string,
    scenarioRevisionId: string,
    graph: ScenarioGraph,
    compiled: CompiledScenario,
    input: unknown,
    controller: AbortController,
    emit: Emit,
    checkpoint?: SerializedSchedulerState,
  ): Promise<void> {
    this.executions.setRunStatus(runId, "running");
    const logger = this.logger.child({ executionId: runId });
    try {
      const runtime = new ScenarioRuntime({
        executionId: runId,
        scenarioId,
        scenarioRevisionId,
        graph,
        compiled,
        input,
        signal: controller.signal,
        logger,
        services: this.services,
        executors: this.executors,
        persistence: this.persistence,
        emit: (event) => this.forward(runId, event, emit),
        checkpoint,
      });
      const result = await runtime.run();
      if (result.status === "suspended") {
        const nodeId = result.suspension!.nodeId;
        const questionId = result.suspension!.questionId;
        const question = this.questions
          ?.forExecution(runId)
          .find((item) => item.id === questionId);
        if (question?.channel === "ui")
          emit({
            type: "approval.required",
            runId,
            nodeId,
            prompt: question.question,
          });
        emit({
          type: "run.suspended",
          runId,
          nodeId,
          questionId,
        });
        return;
      }
      this.executions.setRunStatus(
        runId,
        "completed",
        finalOutput(graph, result.outputs),
      );
      const finished = this.executions.run(runId)!;
      emit({ type: "run.completed", run: finished });
    } catch (error) {
      const cancelled = controller.signal.aborted;
      const message = error instanceof Error ? error.message : String(error);
      this.executions.setRunStatus(
        runId,
        cancelled ? "cancelled" : "failed",
        undefined,
        cancelled ? undefined : message,
      );
      const finished = this.executions.run(runId)!;
      emit({ type: cancelled ? "run.cancelled" : "run.failed", run: finished });
    } finally {
      this.controllers.delete(runId);
    }
  }

  private forward(runId: string, event: RuntimeNodeEvent, emit: Emit): void {
    if (event.type === "node.started" || event.type === "node.completed") {
      if (event.nodeRunId === undefined) return;
      const node = this.executions.nodeRun(event.nodeRunId);
      if (node) emit({ type: event.type, runId, node });
      return;
    }
    if (event.type === "node.output.delta") {
      emit({
        type: "node.output.delta",
        runId,
        nodeId: event.nodeId,
        delta: event.delta ?? "",
      });
    }
  }
}

function finalOutput(
  graph: ScenarioGraph,
  outputs: Record<string, unknown>,
): unknown {
  const terminalNames = graph.nodes
    .filter((node) => scenarioDescriptors.get(node.kind)?.isTerminal)
    .map((node) => node.name)
    .filter((name) => name in outputs);

  if (terminalNames.length === 0) return outputs;

  const picked = terminalNames.map((name) => ({
    name,
    value: textOf(outputs[name]) ?? outputs[name],
  }));

  if (picked.length === 1) return picked[0]!.value;
  return Object.fromEntries(picked.map((item) => [item.name, item.value]));
}

function textOf(entry: unknown): string | undefined {
  const json = (entry as { json?: unknown } | undefined)?.json;
  if (typeof json === "string") return json;
  if (json && typeof json === "object") {
    const text = (json as { text?: unknown }).text;
    if (typeof text === "string") return text;
  }
  return undefined;
}
