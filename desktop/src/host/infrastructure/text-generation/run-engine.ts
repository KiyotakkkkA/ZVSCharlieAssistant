import { streamText, stepCountIs, type ModelMessage, type ToolSet } from "ai";
import type { RunEvent } from "../../../shared/models/chat";
import type {
  ChatMessageContentPart,
  ChatToolCallPart,
  JsonValue,
  RunUsage,
  StartRunInput,
} from "../../../shared/dto";
import { ChatRepository } from "../database/chat.repository";
import { ProviderRegistry } from "./provider.registry";
import { ToolRegistry } from "../tools/tool.registry";
import type { ScenarioRuntimeEngine } from "../automation/engine/scenario-runtime-engine";
import type { MemoryService } from "../../application/services/memory.service";
import type { UserProfileRepository } from "../database/user-profile.repository";
import type { CompactionService } from "../../application/context/compaction.service";
import type { ModelFailover } from "./model-failover";
import type { ProjectContextService } from "../../application/services/project-context.service";
import {
  buildContext,
  measureContext,
} from "../../application/context/context-builder";
import {
  resolveContextBudget,
  type ContextBudget,
} from "../../application/context/context-budget";
import { newEntityId } from "../database/entity-id";
type Emit = (event: RunEvent) => void;

const CONTENT_FLUSH_MS = 400;
const MAX_OUTPUT_CONTINUATIONS = 3;

export class RunEngine {
  private controllers = new Map<string, AbortController>();
  private scenarioRunIds = new Set<string>();
  private profileBlocks = new Map<string, string>();
  constructor(
    private readonly data: ChatRepository,
    private readonly providers: ProviderRegistry,
    private readonly tools: ToolRegistry,
    private readonly memory: MemoryService,
    private readonly userProfile: UserProfileRepository,
    private readonly compaction: CompactionService,
    private readonly failover: ModelFailover,
    private readonly projects: ProjectContextService,
    private readonly scenarios?: ScenarioRuntimeEngine,
  ) {}

  private profileBlock(conversationId: string, mode: string): string {
    if (mode !== "chat" && mode !== "planner") return "";
    const cached = this.profileBlocks.get(conversationId);
    if (cached !== undefined) return cached;
    const block = this.userProfile.promptBlock();
    this.profileBlocks.set(conversationId, block);
    return block;
  }
  async start(
    input: StartRunInput,
    emit: Emit,
  ): Promise<{ runId: string; conversationId: string }> {
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
    const usage = {
      mode: input.mode,
      modelId,
      ...(input.agentId ? { agentId: input.agentId } : {}),
    };
    const conversationId = input.conversationId ?? this.data.createConversation(usage);
    this.data.updateLastUsage(conversationId, usage);
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
      usage,
    );
    const assistantMessage = this.data.addMessage(
      conversationId,
      runId,
      "assistant",
      "",
      "streaming",
      usage,
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
      userMessage.id,
      executionInput,
      agent?.instructions,
      maxSteps,
      controller,
      emit,
    );
    return { runId, conversationId };
  }
  cancel(runId: string) {
    if (this.scenarioRunIds.has(runId)) this.scenarios?.cancel(runId);
    else this.controllers.get(runId)?.abort();
  }

  async compactConversation(
    conversationId: string,
    modelId: string,
    focus: string | undefined,
    emit: Emit,
  ) {
    const project = this.projects.forConversation(conversationId);
    const budget = this.budgetFor(modelId, project?.compactThreshold);
    const segment = await this.compaction.compact({
      conversationId,
      runId: null,
      budget,
      system: "",
      summarizerModelId: modelId,
      reason: "manual",
      focus,
    });
    if (segment)
      emit({ type: "context.compacted", runId: null, conversationId, segment });
    return segment;
  }

  contextWindow(conversationId: string, modelId: string) {
    const project = this.projects.forConversation(conversationId);
    const budget = this.budgetFor(modelId, project?.compactThreshold);
    const used = measureContext({
      system: "",
      messages: this.data.journalMessages(conversationId),
      segments: this.data.contextSegments(conversationId),
      budget,
    });
    return {
      conversationId,
      modelId,
      usedTokens: used,
      usableTokens: budget.usable,
      compactAtTokens: budget.compactAt,
      contextLength: budget.contextLength,
      estimated: budget.estimated,
    };
  }

  private budgetFor(modelId: string, compactThreshold?: number): ContextBudget {
    const info = this.providers.modelInfo(modelId);
    const settings = this.providers.generationSettings(modelId);
    return resolveContextBudget({
      contextLength: info.contextLength,
      maxOutputTokens: settings.maxOutputTokens,
      compactThreshold,
    });
  }

  private startScenario(
    input: StartRunInput,
    text: string,
    emit: Emit,
  ): { runId: string; conversationId: string } {
    if (!this.scenarios) throw new Error("Движок сценариев недоступен");
    if (!input.scenarioId) throw new Error("Сценарий не выбран");
    this.scenarios.assertRunnable(input.scenarioId);
    const usage = { mode: "scenario" as const, scenarioId: input.scenarioId };
    const conversationId =
      input.conversationId ?? this.data.createConversation(usage);
    this.data.updateLastUsage(conversationId, usage);
    const userMessage = this.data.addMessage(
      conversationId,
      null,
      "user",
      text,
      "completed",
      usage,
    );
    const assistantMessage = this.data.addMessage(
      conversationId,
      null,
      "assistant",
      "",
      "streaming",
      usage,
    );
    this.data.updateTitle(conversationId, text);
    let scenarioRunId = "";
    const run = this.scenarios.start(
      input.scenarioId,
      {
        trigger: "chat",
        triggerBindingId: newEntityId(),
        entity: {
          type: "chat_message",
          conversationId,
          messageId: userMessage.id,
          text,
          attachments: this.data.messageAttachments(userMessage.id),
        },
      },
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
    runId: string,
    conversationId: string,
    assistantMessageId: string,
    userMessageId: string,
    input: StartRunInput,
    agentInstructions: string | undefined,
    maxSteps: number,
    controller: AbortController,
    emit: Emit,
  ) {
    const parts: ChatMessageContentPart[] = [];
    let pendingWrite = false;
    let flushTimer: NodeJS.Timeout | undefined;
    const flushContent = () => {
      if (!pendingWrite) return;
      pendingWrite = false;
      this.data.writeMessageParts(assistantMessageId, parts);
    };
    const scheduleFlush = () => {
      pendingWrite = true;
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        flushContent();
      }, CONTENT_FLUSH_MS);
      flushTimer.unref();
    };
    const stopFlushing = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = undefined;
      flushContent();
    };
    const appendText = (kind: "text" | "reasoning", delta: string) => {
      if (!delta) return;
      const last = parts[parts.length - 1];
      if (
        last &&
        (last.type === "text" || last.type === "reasoning") &&
        last.type === kind
      )
        last.text += delta;
      else parts.push({ type: kind, text: delta });
      scheduleFlush();
    };

    try {
      if (!input.modelId) throw new Error("Модель не выбрана");
      this.data.setRunStatus(runId, "running");

      const agentRuntime =
        input.mode === "agent"
          ? this.data.resolveAgent(input.agentId)
          : undefined;
      const baseSystem =
        input.mode === "planner"
          ? "Составь практичный пошаговый план. Не выполняй действия без необходимости."
          : (agentInstructions ?? "Ты полезный ассистент. Отвечай по существу.");
      const profileBlock = this.profileBlock(conversationId, input.mode);
      const memoryBlock = this.memory.contextBlock({
        agentMayRead: Boolean(agentRuntime?.memoryRead),
        query: input.text,
      });
      const project = this.projects.forConversation(conversationId);
      const projectBlock = this.projects.promptBlock(project);
      const system = `${baseSystem}${profileBlock}${projectBlock}${this.tools.skillCatalog(
        agentRuntime?.allowedSkillIds ?? [],
      )}${memoryBlock}`;

      let activeModelId = input.modelId;

      const tools: ToolSet | undefined =
        input.mode === "agent"
          ? this.tools.createForChat(runId, emit, {
              signal: controller.signal,
              conversationId,
              runId,
              agentId: input.agentId,
              memoryRead: Boolean(agentRuntime?.memoryRead),
              memoryWrite: Boolean(agentRuntime?.memoryWrite),
              allowedToolIds: agentRuntime?.allowedToolIds ?? [],
              allowedVectorStoreIds: agentRuntime?.allowedVectorStoreIds ?? [],
              retrievalLimit: agentRuntime?.retrieval_limit ?? 5,
              allowedSkillIds: agentRuntime?.allowedSkillIds ?? [],
              terminalPolicy: agentRuntime?.terminalPolicy,
              directoryPolicy: agentRuntime?.directoryPolicy,
              projectGrants: project?.grants,
            })
          : undefined;

      let continuations = 0;
      for (let step = 0; step < maxSteps + continuations; step += 1) {
        if (controller.signal.aborted) break;
        flushContent();

        let attempt = 0;
        let compacted = false;
        let stepResult: StepResult | undefined;

        for (;;) {
          if (controller.signal.aborted) break;
          const budget = this.budgetFor(
            activeModelId,
            project?.compactThreshold,
          );
          const generationSettings =
            this.providers.generationSettings(activeModelId);

          if (compacted) {
            await this.forceCompaction({
              conversationId,
              runId,
              system,
              budget,
              modelId: activeModelId,
              protectedFromMessageId: userMessageId,
              emit,
            });
          } else {
            await this.compactIfNeeded({
              conversationId,
              runId,
              system,
              budget,
              modelId: activeModelId,
              protectedFromMessageId: userMessageId,
              emit,
            });
          }

          const context = buildContext({
            system,
            messages: this.data.journalMessages(conversationId),
            segments: this.data.contextSegments(conversationId),
            budget,
            protectedFromMessageId: userMessageId,
          });
          emit({
            type: "context.window",
            window: {
              conversationId,
              modelId: activeModelId,
              usedTokens: context.tokens,
              usableTokens: budget.usable,
              compactAtTokens: budget.compactAt,
              contextLength: budget.contextLength,
              estimated: budget.estimated,
            },
          });

          try {
            stepResult = await this.runStep({
              runId,
              step,
              system,
              messages: context.messages,
              modelId: activeModelId,
              generationSettings,
              tools,
              controller,
              emit,
              assistantMessageId,
              parts,
              appendText,
              scheduleFlush,
            });
            break;
          } catch (error) {
            if (controller.signal.aborted) throw error;
            const decision = this.failover.decide(error, {
              activeModelId,
              attempt,
              compacted,
            });
            if (decision.kind === "fail") throw error;
            if (decision.kind === "retry") {
              attempt += 1;
              await delay(decision.delayMs);
              continue;
            }
            if (decision.kind === "compact") {
              compacted = true;
              continue;
            }
            const change = this.failover.record(runId, conversationId, {
              from: activeModelId,
              to: decision.modelId,
              reason: decision.reason,
              detail: decision.detail,
            });
            activeModelId = decision.modelId;
            attempt = 0;
            emit({
              type: "run.model.switched",
              runId,
              conversationId,
              change,
            });
          }
        }

        flushContent();
        if (!stepResult) break;
        if (stepResult.hasToolCalls) continue;

        if (
          stepResult.finishReason === "length" &&
          continuations < MAX_OUTPUT_CONTINUATIONS
        ) {
          continuations += 1;
          const wider = this.failover.widerOutputModel(activeModelId);
          if (wider) {
            const change = this.failover.record(runId, conversationId, {
              from: activeModelId,
              to: wider,
              reason: "output_limit",
              detail: "Ответ не поместился в лимит вывода модели",
            });
            activeModelId = wider;
            emit({
              type: "run.model.switched",
              runId,
              conversationId,
              change,
            });
          }
          continue;
        }
        break;
      }

      stopFlushing();
      this.data.setMessageStatus(assistantMessageId, "completed");
      this.data.setRunStatus(runId, "completed");
      emit({
        type: "run.usage",
        runId,
        conversationId,
        usage: this.data.runUsage(runId),
      });
      emit({ type: "run.completed", runId });
    } catch (error) {
      stopFlushing();
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

  private async forceCompaction(input: {
    conversationId: string;
    runId: string;
    system: string;
    budget: ContextBudget;
    modelId: string;
    protectedFromMessageId: string;
    emit: Emit;
  }) {
    const segment = await this.compaction.compact({
      conversationId: input.conversationId,
      runId: input.runId,
      budget: input.budget,
      system: input.system,
      summarizerModelId: input.modelId,
      reason: "overflow",
      protectedFromMessageId: input.protectedFromMessageId,
    });
    if (segment)
      input.emit({
        type: "context.compacted",
        runId: input.runId,
        conversationId: input.conversationId,
        segment,
      });
  }

  private async compactIfNeeded(input: {
    conversationId: string;
    runId: string;
    system: string;
    budget: ContextBudget;
    modelId: string;
    protectedFromMessageId: string;
    emit: Emit;
  }) {
    const needed = this.compaction.shouldCompact({
      conversationId: input.conversationId,
      system: input.system,
      budget: input.budget,
      protectedFromMessageId: input.protectedFromMessageId,
    });
    if (!needed) return;
    const segment = await this.compaction.compact({
      conversationId: input.conversationId,
      runId: input.runId,
      budget: input.budget,
      system: input.system,
      summarizerModelId: input.modelId,
      reason: "threshold",
      protectedFromMessageId: input.protectedFromMessageId,
    });
    if (segment)
      input.emit({
        type: "context.compacted",
        runId: input.runId,
        conversationId: input.conversationId,
        segment,
      });
  }

  private async runStep(input: {
    runId: string;
    step: number;
    system: string;
    messages: ModelMessage[];
    modelId: string;
    generationSettings: { maxOutputTokens: number; temperature: number; topP: number };
    tools: ToolSet | undefined;
    controller: AbortController;
    emit: Emit;
    assistantMessageId: string;
    parts: ChatMessageContentPart[];
    appendText: (kind: "text" | "reasoning", delta: string) => void;
    scheduleFlush: () => void;
  }): Promise<StepResult> {
    const {
      runId,
      controller,
      emit,
      assistantMessageId,
      parts,
      appendText,
      scheduleFlush,
    } = input;
    let hasToolCalls = false;
    let usage: RunUsage | undefined;
    let finishReason: string | undefined;

    const result = streamText({
      model: this.providers.resolve(input.modelId),
      ...input.generationSettings,
      system: input.system,
      messages: input.messages,
      tools: input.tools,
      stopWhen: stepCountIs(1),
      abortSignal: controller.signal,
    });

    for await (const raw of result.stream) {
      const part = raw as unknown as StreamPart;
      if (part.type === "error") {
        throw normalizeStreamError(part.error);
      } else if (part.type === "text-delta") {
        appendText("text", part.text ?? "");
        emit({
          type: "text.delta",
          runId,
          messageId: assistantMessageId,
          delta: part.text ?? "",
        });
      } else if (part.type === "reasoning-delta") {
        appendText("reasoning", part.text ?? "");
        emit({
          type: "reasoning.delta",
          runId,
          messageId: assistantMessageId,
          delta: part.text ?? "",
        });
      } else if (part.type === "tool-call") {
        hasToolCalls = true;
        parts.push({
          type: "tool-call",
          toolCallId: part.toolCallId ?? "",
          toolName: part.toolName ?? "",
          input: (part.input ?? null) as JsonValue,
        } satisfies ChatToolCallPart);
        scheduleFlush();
      } else if (part.type === "tool-result") {
        parts.push({
          type: "tool-result",
          toolCallId: part.toolCallId ?? "",
          toolName: part.toolName ?? "",
          output: (part.output ?? null) as JsonValue,
        });
        scheduleFlush();
      } else if (part.type === "tool-error") {
        parts.push({
          type: "tool-result",
          toolCallId: part.toolCallId ?? "",
          toolName: part.toolName ?? "",
          output: errorToJson(part.error),
          isError: true,
        });
        scheduleFlush();
      } else if (part.type === "finish-step" || part.type === "finish") {
        finishReason = part.finishReason ?? finishReason;
        usage = normalizeUsage(part.usage ?? part.totalUsage, input.modelId, this.providers) ?? usage;
      }
    }

    if (usage) this.data.addRunUsage(runId, usage);
    this.data.addStep(
      runId,
      input.step,
      { messages: input.messages.length, hasToolCalls },
      finishReason,
      usage,
    );
    return { hasToolCalls, finishReason };
  }
}

interface StepResult {
  hasToolCalls: boolean;
  finishReason: string | undefined;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

interface StreamPart {
  type: string;
  text?: string;
  error?: unknown;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  finishReason?: string;
  usage?: RawUsage;
  totalUsage?: RawUsage;
}

interface RawUsage {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

function normalizeUsage(
  usage: RawUsage | undefined,
  modelId: string,
  providers: ProviderRegistry,
): RunUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  let costUsd = 0;
  try {
    const info = providers.modelInfo(modelId);
    costUsd =
      inputTokens * info.promptPricePerToken +
      outputTokens * info.completionPricePerToken;
  } catch {
    costUsd = 0;
  }
  return {
    inputTokens,
    outputTokens,
    reasoningTokens: usage.reasoningTokens ?? 0,
    cachedInputTokens: usage.cachedInputTokens ?? 0,
    costUsd,
  };
}

function errorToJson(error: unknown): JsonValue {
  if (error instanceof Error) return { error: error.message };
  if (typeof error === "string") return { error };
  return { error: "Инструмент завершился с ошибкой" };
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
