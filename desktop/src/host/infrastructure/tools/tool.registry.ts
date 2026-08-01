import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { ChatDataSource } from "../database/chat.data-source";
import type { RunEvent } from "../../../ipc/contracts";
type Emit = (event: RunEvent) => void;
export class ApprovalCoordinator {
  private pending = new Map<number, (approved: boolean) => void>();
  wait(id: number): Promise<boolean> {
    return new Promise((resolve) => this.pending.set(id, resolve));
  }
  resolve(id: number, approved: boolean) {
    const resolve = this.pending.get(id);
    if (!resolve) throw new Error("Запрос подтверждения не найден");
    this.pending.delete(id);
    resolve(approved);
  }
  clear() {
    for (const resolve of this.pending.values()) resolve(false);
    this.pending.clear();
  }
}
export class ToolRegistry {
  constructor(
    private readonly data: ChatDataSource,
    private readonly approvals: ApprovalCoordinator,
  ) {}
  create(
    runId: number,
    emit: Emit,
    signal: AbortSignal,
    allowed: string[],
  ): ToolSet {
    const tools: ToolSet = {
      current_time: tool({
        description: "Возвращает текущее локальное время",
        inputSchema: z.object({}),
        execute: async (_input, { toolCallId }) =>
          this.execute(
            runId,
            toolCallId,
            "current_time",
            "read",
            {},
            emit,
            signal,
            async () => ({ iso: new Date().toISOString() }),
          ),
      }),
      save_note: tool({
        description: "Сохраняет заметку пользователя. Требует подтверждения.",
        inputSchema: z.object({ text: z.string().min(1).max(2000) }),
        execute: async (input, { toolCallId }) =>
          this.execute(
            runId,
            toolCallId,
            "save_note",
            "write",
            input,
            emit,
            signal,
            async () => ({ saved: true, text: input.text }),
          ),
      }),
    };
    return Object.fromEntries(
      Object.entries(tools).filter(([id]) => allowed.includes(id)),
    );
  }
  private async execute(
    runId: number,
    callId: string,
    toolId: string,
    risk: "read" | "write",
    input: unknown,
    emit: Emit,
    signal: AbortSignal,
    action: () => Promise<unknown>,
  ) {
    const needsApproval = risk !== "read";
    const id = this.data.createToolCall(
      runId,
      callId,
      toolId,
      risk,
      input,
      needsApproval ? "waiting_for_approval" : "requested",
    );
    emit({ type: "tool.requested", runId, toolCallId: id, toolId });
    if (needsApproval) {
      this.data.setRunStatus(runId, "waiting_for_approval");
      emit({ type: "approval.required", runId, toolCallId: id, toolId, input });
      const approved = await this.approvals.wait(id);
      if (!approved) {
        this.data.finishToolCall(id, "denied");
        throw new Error("Пользователь отклонил вызов инструмента");
      }
    }
    if (signal.aborted) throw new Error("Выполнение отменено");
    this.data.setRunStatus(runId, "running");
    emit({ type: "tool.running", runId, toolCallId: id, toolId });
    try {
      const output = await action();
      this.data.finishToolCall(id, "completed", output);
      emit({ type: "tool.completed", runId, toolCallId: id, toolId });
      return output;
    } catch (error) {
      this.data.finishToolCall(
        id,
        "failed",
        undefined,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
