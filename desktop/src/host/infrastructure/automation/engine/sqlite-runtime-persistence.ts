import type Database from "better-sqlite3";
import type { RuntimePersistence } from "./runtime";
import type { SerializedSchedulerState } from "./scheduler-state";
import type { ScenarioItems } from "../../../../shared/scenario/items";
import { PayloadStore } from "./payload-store";
import { newEntityId } from "../../database/entity-id";

export class SqliteRuntimePersistence implements RuntimePersistence {
  private readonly payloads: PayloadStore;

  constructor(
    private readonly db: Database.Database,
    payloadsRoot: string,
  ) {
    this.payloads = new PayloadStore(payloadsRoot);
  }

  startNode(input: {
    executionId: string;
    nodeId: string;
    nodeKind: string;
    attempt: number;
    iteration: number;
    inputs: Record<string, ScenarioItems>;
  }): string {
    const nodeRunId = newEntityId();
    this.db
      .prepare(
        `INSERT INTO scenario_node_runs(id,execution_id,node_id,node_kind,iteration,attempt,status,input_json,started_at)
         VALUES(?,?,?,?,?,?,'running','{}',CURRENT_TIMESTAMP)`,
      )
      .run(
        nodeRunId,
        input.executionId,
        input.nodeId,
        input.nodeKind,
        input.iteration,
        input.attempt,
      );

    const stored = this.payloads.put(
      input.executionId,
      nodeRunId,
      "input",
      input.inputs,
    );
    this.db
      .prepare(
        `UPDATE scenario_node_runs SET input_json=?, input_ref=? WHERE id=?`,
      )
      .run(stored.json, stored.ref, nodeRunId);

    return nodeRunId;
  }

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
  }): void {
    const row = this.db
      .prepare(`SELECT execution_id FROM scenario_node_runs WHERE id=?`)
      .get(input.nodeRunId) as { execution_id: string } | undefined;
    if (!row) return;

    const stored =
      input.outputs !== undefined
        ? this.payloads.put(
            row.execution_id,
            input.nodeRunId,
            "output",
            input.outputs,
          )
        : { json: null, ref: null };

    this.db
      .prepare(
        `UPDATE scenario_node_runs SET
           status=?, output_json=?, output_ref=?, error_message=?, error_code=?,
           partial_output=?, diagnostics_json=?, duration_ms=?,
           completed_at=CASE WHEN ? IN ('completed','failed','cancelled','skipped') THEN CURRENT_TIMESTAMP ELSE completed_at END
         WHERE id=?`,
      )
      .run(
        input.status,
        stored.json,
        stored.ref,
        input.error ?? null,
        input.errorCode ?? null,
        input.partialOutput ?? null,
        input.diagnostics !== undefined
          ? JSON.stringify(input.diagnostics)
          : null,
        input.durationMs ?? null,
        input.status,
        input.nodeRunId,
      );
  }

  saveCheckpoint(executionId: string, state: SerializedSchedulerState): void {
    this.db
      .prepare(
        `UPDATE execution_runs SET checkpoint_json=?, engine_version=2, status='waiting_for_approval' WHERE id=?`,
      )
      .run(JSON.stringify(state), executionId);
  }

  loadCheckpoint(executionId: string): SerializedSchedulerState | undefined {
    const row = this.db
      .prepare(`SELECT checkpoint_json FROM execution_runs WHERE id=?`)
      .get(executionId) as { checkpoint_json: string | null } | undefined;
    return row?.checkpoint_json
      ? (JSON.parse(row.checkpoint_json) as SerializedSchedulerState)
      : undefined;
  }

  clearCheckpoint(executionId: string): void {
    this.db
      .prepare(`UPDATE execution_runs SET checkpoint_json=NULL WHERE id=?`)
      .run(executionId);
  }

  nodeRunPayloads(nodeRunId: string): { inputs: unknown; outputs: unknown } {
    const row = this.db
      .prepare(
        `SELECT input_json,input_ref,output_json,output_ref FROM scenario_node_runs WHERE id=?`,
      )
      .get(nodeRunId) as
      | {
          input_json: string | null;
          input_ref: string | null;
          output_json: string | null;
          output_ref: string | null;
        }
      | undefined;
    if (!row) return { inputs: undefined, outputs: undefined };
    return {
      inputs: this.payloads.get(row.input_json, row.input_ref),
      outputs: this.payloads.get(row.output_json, row.output_ref),
    };
  }

  recordLlmCall(input: {
    executionId: string;
    nodeRunId: string;
    modelId: string | null;
    systemPrompt?: string;
    prompt?: unknown;
    outputText?: string;
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
    finishReason?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO llm_calls(id,execution_id,node_run_id,model_id,system_prompt,prompt_json,output_text,prompt_tokens,completion_tokens,latency_ms,finish_reason)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        newEntityId(),
        input.executionId,
        input.nodeRunId,
        input.modelId,
        input.systemPrompt ?? null,
        input.prompt !== undefined ? JSON.stringify(input.prompt) : null,
        input.outputText ?? null,
        input.promptTokens ?? null,
        input.completionTokens ?? null,
        input.latencyMs ?? null,
        input.finishReason ?? null,
      );
  }
}
