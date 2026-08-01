import { streamText, stepCountIs, type ModelMessage } from "ai";
import type { RunEvent, StartRunInput } from "../../../ipc/contracts";
import { ChatDataSource } from "../database/chat.data-source";
import { ProviderRegistry } from "./provider.registry";
import { ApprovalCoordinator, ToolRegistry } from "../tools/tool.registry";
type Emit = (event: RunEvent) => void;
export class RunEngine {
  private controllers = new Map<number, AbortController>();
  readonly approvals = new ApprovalCoordinator();
  private readonly tools: ToolRegistry;
  constructor(
    private readonly data: ChatDataSource,
    private readonly providers: ProviderRegistry,
  ) {
    this.tools = new ToolRegistry(data, this.approvals);
  }
  async start(
    input: StartRunInput,
    emit: Emit,
  ): Promise<{ runId: number; conversationId: number }> {
    const text = input.text.trim();
    if (!text) throw new Error("Сообщение не может быть пустым");
    const agent =
      input.mode === "agent"
        ? this.data.resolveAgent(input.agentId)
        : undefined;
    if (input.mode === "agent" && !agent)
      throw new Error("Агент не найден или отключён");
    this.providers.resolve(input.modelId);
    const conversationId =
      input.conversationId ??
      this.data.createConversation(input.mode, input.agentId, input.modelId);
    const maxSteps =
      input.mode === "chat" ? 3 : Math.min(agent?.max_tool_calls ?? 8, 20);
    const runId = this.data.createRun(
      conversationId,
      input.agentId,
      input.modelId,
      maxSteps,
    );
    const userMessage = this.data.addMessage(
      conversationId,
      runId,
      "user",
      text,
      "completed",
    );
    const assistantMessage = this.data.addMessage(
      conversationId,
      runId,
      "assistant",
      "",
      "streaming",
    );
    this.data.updateTitle(conversationId, text);
    emit({
      type: "run.started",
      runId,
      conversationId,
      userMessage,
      assistantMessage,
    });
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    void this.execute(
      runId,
      conversationId,
      assistantMessage.id,
      input,
      agent?.instructions,
      maxSteps,
      controller,
      emit,
    );
    return { runId, conversationId };
  }
  cancel(runId: number) {
    this.controllers.get(runId)?.abort();
    this.approvals.clear();
  }
  private async execute(
    runId: number,
    conversationId: number,
    assistantMessageId: number,
    input: StartRunInput,
    agentInstructions: string | undefined,
    maxSteps: number,
    controller: AbortController,
    emit: Emit,
  ) {
    try {
      this.data.setRunStatus(runId, "running");
      const history = this.data
        .messages(conversationId)
        .filter((m) => m.id !== assistantMessageId)
        .map((m): ModelMessage => ({
          role:
            m.role === "tool"
              ? "assistant"
              : (m.role as "user" | "assistant" | "system"),
          content: m.text,
        }));
      const system =
        input.mode === "planner"
          ? "Составь практичный пошаговый план. Не выполняй действия без необходимости."
          : (agentInstructions ??
            "Ты полезный ассистент. Отвечай по существу.");
      let stepIndex = 0;
      const allowedTools =
        input.mode === "agent"
          ? (this.data.resolveAgent(input.agentId)?.allowedToolIds ?? [])
          : ["current_time"];
      const result = streamText({
        model: this.providers.resolve(input.modelId),
        system,
        messages: history,
        tools: this.tools.create(runId, emit, controller.signal, allowedTools),
        stopWhen: stepCountIs(maxSteps),
        abortSignal: controller.signal,
        onStepFinish: ({ finishReason, toolCalls, toolResults }) => {
          this.data.addStep(
            runId,
            stepIndex++,
            { toolCalls, toolResults },
            finishReason,
          );
        },
      });
      for await (const part of result.stream) {
        if (part.type === "text-delta") {
          this.data.appendText(assistantMessageId, part.text);
          emit({
            type: "text.delta",
            runId,
            messageId: assistantMessageId,
            delta: part.text,
          });
        } else if (part.type === "reasoning-delta") {
          this.data.appendReasoning(assistantMessageId, part.text);
          emit({
            type: "reasoning.delta",
            runId,
            messageId: assistantMessageId,
            delta: part.text,
          });
        }
      }
      this.data.setMessageStatus(assistantMessageId, "completed");
      this.data.setRunStatus(runId, "completed");
      emit({ type: "run.completed", runId });
    } catch (error) {
      const cancelled = controller.signal.aborted;
      this.data.setMessageStatus(
        assistantMessageId,
        cancelled ? "cancelled" : "failed",
      );
      this.data.setRunStatus(
        runId,
        cancelled ? "cancelled" : "failed",
        error instanceof Error ? error.message : String(error),
      );
      emit(
        cancelled
          ? { type: "run.cancelled", runId }
          : {
              type: "run.failed",
              runId,
              message:
                error instanceof Error ? error.message : "Ошибка генерации",
            },
      );
    } finally {
      this.controllers.delete(runId);
    }
  }
}
