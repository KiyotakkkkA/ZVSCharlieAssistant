import { streamText, stepCountIs, type ModelMessage } from "ai";
import type { RunEvent } from "../../../shared/models/chat";
import type { StartRunInput } from "../../../shared/dto";
import { ChatDataSource } from "../database/chat.data-source";
import { ProviderRegistry } from "./provider.registry";
import { ToolRegistry } from "../tools/tool.registry";
import type { ScenarioRunEngine } from "../automation/scenario-run-engine";
type Emit = (event: RunEvent) => void;
export class RunEngine {
  private controllers = new Map<number, AbortController>();
  private scenarioRunIds = new Set<number>();
  constructor(
    private readonly data: ChatDataSource,
    private readonly providers: ProviderRegistry,
    private readonly tools: ToolRegistry,
    private readonly scenarios?: ScenarioRunEngine,
  ) {}
  async start(
    input: StartRunInput,
    emit: Emit,
  ): Promise<{ runId: number; conversationId: number }> {
    const text = input.text.trim();
    if (!text) throw new Error("Сообщение не может быть пустым");
    if (input.mode === "scenario") return this.startScenario(input, text, emit);
    const agent =
      input.mode === "agent"
        ? this.data.resolveAgent(input.agentId)
        : undefined;
    if (input.mode === "agent" && !agent)
      throw new Error("Агент не найден или отключён");
    const modelId =
      input.mode === "agent" ? agent?.text_model_id : input.modelId;
    if (!modelId)
      throw new Error(
        input.mode === "agent"
          ? "Для агента не выбрана текстовая модель"
          : "Модель не выбрана",
      );
    this.providers.resolve(modelId);
    const executionInput: StartRunInput = { ...input, modelId };
    const conversationId =
      input.conversationId ??
      this.data.createConversation(input.mode, input.agentId, modelId);
    const maxSteps =
      input.mode === "agent" ? Math.min(agent?.max_tool_calls ?? 8, 20) : 1;
    const runId = this.data.createRun(
      conversationId,
      input.agentId,
      modelId,
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
      executionInput,
      agent?.instructions,
      maxSteps,
      controller,
      emit,
    );
    return { runId, conversationId };
  }
  cancel(runId: number) {
    if (this.scenarioRunIds.has(runId)) this.scenarios?.cancel(runId);
    else this.controllers.get(runId)?.abort();
  }
  private startScenario(
    input: StartRunInput,
    text: string,
    emit: Emit,
  ): { runId: number; conversationId: number } {
    if (!this.scenarios) throw new Error("Движок сценариев недоступен");
    if (!input.scenarioId) throw new Error("Сценарий не выбран");
    this.scenarios.assertRunnable(input.scenarioId);
    const conversationId =
      input.conversationId ??
      this.data.createConversation("scenario", undefined, undefined);
    const userMessage = this.data.addMessage(
      conversationId,
      null,
      "user",
      text,
      "completed",
    );
    const assistantMessage = this.data.addMessage(
      conversationId,
      null,
      "assistant",
      "",
      "streaming",
    );
    this.data.updateTitle(conversationId, text);
    let scenarioRunId = 0;
    const run = this.scenarios.start(
      input.scenarioId,
      { message: text },
      "chat",
      (event) => {
        if (event.type === "run.started") {
          scenarioRunId = event.run.id;
          this.scenarioRunIds.add(event.run.id);
          emit({
            type: "run.started",
            runId: event.run.id,
            conversationId,
            userMessage,
            assistantMessage,
          });
          emit({ type: "scenario.run", run: event.run });
        } else if (
          event.type === "node.started" ||
          event.type === "node.completed"
        ) {
          emit({ type: "scenario.node", runId: event.runId, node: event.node });
        } else if (event.type === "node.output.delta") {
          emit({
            type: "scenario.node.delta",
            runId: event.runId,
            nodeId: event.nodeId,
            delta: event.delta,
          });
        } else if (event.type === "approval.required") {
          emit({
            type: "scenario.approval.required",
            runId: event.runId,
            nodeId: event.nodeId,
            prompt: event.prompt,
          });
        } else if (event.type === "run.completed") {
          this.scenarioRunIds.delete(event.run.id);
          const output =
            typeof event.run.output === "string"
              ? event.run.output
              : JSON.stringify(event.run.output, null, 2);
          this.data.replaceText(assistantMessage.id, output);
          this.data.setMessageStatus(assistantMessage.id, "completed");
          emit({
            type: "text.delta",
            runId: event.run.id,
            messageId: assistantMessage.id,
            delta: output,
          });
          emit({ type: "scenario.run", run: event.run });
          emit({ type: "run.completed", runId: event.run.id });
        } else if (
          event.type === "run.failed" ||
          event.type === "run.cancelled"
        ) {
          this.scenarioRunIds.delete(event.run.id);
          this.data.setMessageStatus(
            assistantMessage.id,
            event.type === "run.failed" ? "failed" : "cancelled",
          );
          emit({ type: "scenario.run", run: event.run });
          emit(
            event.type === "run.failed"
              ? {
                  type: "run.failed",
                  runId: event.run.id,
                  message: event.run.error ?? "Сценарий завершился с ошибкой",
                }
              : { type: "run.cancelled", runId: event.run.id },
          );
        }
      },
      conversationId,
    );
    this.data.linkMessageToScenarioRun(assistantMessage.id, run.id);
    return { runId: scenarioRunId || run.id, conversationId };
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
      if (!input.modelId) throw new Error("Модель не выбрана");
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
      const baseSystem =
        input.mode === "planner"
          ? "Составь практичный пошаговый план. Не выполняй действия без необходимости."
          : (agentInstructions ??
            "Ты полезный ассистент. Отвечай по существу.");
      let stepIndex = 0;
      const agentRuntime =
        input.mode === "agent"
          ? this.data.resolveAgent(input.agentId)
          : undefined;
      const system = `${baseSystem}${this.tools.skillCatalog(agentRuntime?.allowedSkillIds ?? [])}`;
      const generationSettings = this.providers.generationSettings(
        input.modelId,
      );
      const result = streamText({
        model: this.providers.resolve(input.modelId),
        ...generationSettings,
        system,
        messages: history,
        tools:
          input.mode === "agent"
            ? this.tools.createForChat(runId, emit, {
                signal: controller.signal,
                allowedToolIds: agentRuntime?.allowedToolIds ?? [],
                allowedVectorStoreIds:
                  agentRuntime?.allowedVectorStoreIds ?? [],
                retrievalLimit: agentRuntime?.retrieval_limit ?? 5,
                allowedSkillIds: agentRuntime?.allowedSkillIds ?? [],
                terminalPolicy: agentRuntime?.terminalPolicy,
                directoryPolicy: agentRuntime?.directoryPolicy,
              })
            : undefined,
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
        if (part.type === "error") {
          throw normalizeStreamError(part.error);
        } else if (part.type === "text-delta") {
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

function normalizeStreamError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim())
      return new Error(message);
  }
  return new Error("Ошибка при обращении к модели");
}
