import type { ToolSet } from "ai";
import type { RunEvent } from "../../../shared/models/chat";
import type { Project } from "../../../shared/models/project";
import type {
  ChatMessageContentPart,
  ChatToolCallPart,
  ContextWindowBreakdownEntry,
  JsonValue,
  RunUsage,
  StartRunInput,
} from "../../../shared/dto";
import { ChatRepository } from "../database/chat.repository";
import { ProviderRegistry } from "./provider.registry";
import {
  filterToolIdsByPermission,
  ToolRegistry,
} from "../tools/tool.registry";
import type { ScenarioRuntimeEngine } from "../automation/engine/scenario-runtime-engine";
import type { MemoryService } from "../../application/services/memory.service";
import type { UserProfileRepository } from "../database/user-profile.repository";
import type { CompactionService } from "../../application/context/compaction.service";
import type { ModelFailover } from "./model-failover";
import type { ModelSwitchReason } from "../../../shared/dto";
import type { ProjectContextService } from "../../application/services/project-context.service";
import {
  buildContext,
  measureContext,
} from "../../application/context/context-builder";
import {
  resolveContextBudget,
  type ContextBudget,
} from "../../application/context/context-budget";
import { estimateTextTokens } from "../../application/context/token-estimator";
import { runStepWithRetry } from "../../application/context/agentic-step-loop";
import { newEntityId } from "../database/entity-id";
import {
  generationLimitKind,
  isMissingFinishReasonError,
  limitFailureMessage,
} from "./generation-finish";
import type { VectorStoreService } from "../vector-store/vector-store.service";
import type { NativeIndexerService } from "../vector-store/native-indexer.service";
type Emit = (event: RunEvent) => void;

const CONTENT_FLUSH_MS = 400;
const MAX_OUTPUT_CONTINUATIONS = 3;
const CONTINUATION_PROMPT =
  "Продолжи предыдущий ответ строго с места остановки. Не повторяй уже выведенный текст и не начинай ответ заново.";
const TOOL_INPUT_CONTINUATION_PROMPT =
  'Предыдущая генерация оборвалась при подготовке вызова инструмента из-за лимита вывода. Продолжи текущую операцию, не повторяя завершённые инструменты. Если fs_write_begin или reports_begin уже завершён, возьми sessionId и nextSequence из его результата и продолжай через fs_write_chunk либо reports_add_blocks; не создавай новую сессию. Если сессия ещё не создана, начни её. Для paragraph используй строго {"type":"paragraph","paragraphs":["текст"]}, поля text у него нет. Передавай компактные части и в конце обязательно вызови fs_write_commit либо reports_commit.';
const MAX_ATTACHMENT_BYTES = 20 * 1_048_576;
const MAX_ATTACHMENTS_TOTAL_BYTES = 40 * 1_048_576;
const MAX_ATTACHMENT_CONTEXT_CHARS = 48_000;

export class RunEngine {
  private controllers = new Map<string, AbortController>();
  private scenarioRunIds = new Set<string>();
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
    private readonly vectorStores?: VectorStoreService,
    private readonly textExtraction?: NativeIndexerService,
    private readonly eventObserver?: Emit,
  ) {}

  private profileBlock(mode: string): string {
    if (mode !== "chat" && mode !== "planner") return "";
    return this.userProfile.promptBlock();
  }

  private mayReadMemory(
    mode: string,
    agentRuntime: { memoryRead: boolean } | undefined,
  ): boolean {
    return mode === "agent" ? Boolean(agentRuntime?.memoryRead) : true;
  }
  async start(
    input: StartRunInput,
    emit: Emit,
  ): Promise<{ runId: string; conversationId: string }> {
    const publish: Emit = (event) => {
      this.eventObserver?.(event);
      emit(event);
    };
    const text = input.text.trim();
    if (!text) throw new Error("Сообщение не может быть пустым");
    if (input.mode === "scenario")
      return this.startScenario(input, text, publish);
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
      permissionMode: input.permissionMode ?? "edit",
    };
    const conversationId =
      input.conversationId ?? this.data.createConversation(usage);
    if (input.projectId)
      this.projects.assignConversation(conversationId, input.projectId);
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
      attachmentMetadataParts(input.attachments),
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
    publish({
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
      publish,
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
      summarizerModelId: this.resolveSummarizerModelId(project, modelId),
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
    const usage = this.data.usage(conversationId);
    const mode = usage?.mode ?? "chat";
    const agentRuntime =
      mode === "agent" ? this.data.resolveAgent(usage?.agentId) : undefined;
    const baseSystem = "Ты полезный ассистент. Отвечай по существу.";
    const profileBlock = this.profileBlock(mode);
    const projectBlock = this.projects.promptBlock(project);
    const memoryBlock = this.memory.contextBlock({
      mayRead: this.mayReadMemory(mode, agentRuntime),
      query: "",
    });
    const system = `${baseSystem}${profileBlock}${projectBlock}${memoryBlock}`;
    const used = measureContext({
      system,
      messages: this.data.journalMessages(conversationId),
      segments: this.data.contextSegments(conversationId),
      budget,
    });
    const breakdown = this.systemBreakdown(
      [
        { label: "Системные инструкции", text: baseSystem },
        { label: "Профиль пользователя", text: profileBlock },
        { label: "Проект", text: projectBlock },
        { label: "Память", text: memoryBlock },
      ],
      used,
      system,
    );
    return {
      conversationId,
      modelId,
      usedTokens: used,
      usableTokens: budget.usable,
      compactAtTokens: budget.compactAt,
      contextLength: budget.contextLength,
      estimated: budget.estimated,
      breakdown,
    };
  }

  private resolveSummarizerModelId(
    project: Project | undefined,
    fallback: string,
  ): string {
    const preferred = project?.compactModelId;
    if (!preferred || preferred === fallback) return fallback;
    const enabled = this.data.listEnabledTextModels();
    return enabled.some((model) => model.id === preferred)
      ? preferred
      : fallback;
  }

  private systemBreakdown(
    blocks: Array<{ label: string; text: string }>,
    usedTokens: number,
    system: string,
  ): ContextWindowBreakdownEntry[] {
    const entries = blocks
      .filter((block) => block.text.trim().length > 0)
      .map((block) => ({
        label: block.label,
        tokens: estimateTextTokens(block.text),
      }));
    const messagesTokens = Math.max(0, usedTokens - estimateTextTokens(system));
    if (messagesTokens > 0)
      entries.push({ label: "Сообщения диалога", tokens: messagesTokens });
    return entries;
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
    const usage = {
      mode: "scenario" as const,
      scenarioId: input.scenarioId,
      permissionMode: input.permissionMode ?? "edit",
    };
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
      attachmentMetadataParts(input.attachments),
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
      controller.signal.throwIfAborted();

      const agentRuntime =
        input.mode === "agent"
          ? this.data.resolveAgent(input.agentId)
          : undefined;
      const baseSystem =
        input.mode === "planner"
          ? "Составь практичный пошаговый план. Не выполняй действия без необходимости."
          : (agentInstructions ??
            "Ты полезный ассистент. Отвечай по существу.");
      const profileBlock = this.profileBlock(input.mode);
      const memoryBlock = this.memory.contextBlock({
        mayRead: this.mayReadMemory(input.mode, agentRuntime),
        query: input.text,
      });
      const project = this.projects.forConversation(conversationId);
      const projectBlock = this.projects.promptBlock(project);
      const attachmentBlock = await this.attachmentContextBlock(
        input.attachments ?? [],
        controller.signal,
      );
      const retrieval = await this.retrieveVectorContext(
        runId,
        input.vectorStoreIds ?? [],
        input.text,
        controller.signal,
        emit,
        parts,
      );
      const retrievalBlock = vectorContextBlock(retrieval);
      const skillsBlock = this.tools.skillCatalog(
        agentRuntime?.allowedSkillIds ?? [],
      );
      const selectedSkillsBlock = this.tools.selectedSkillBlock(
        input.skillIds ?? [],
      );
      const system = `${baseSystem}${profileBlock}${projectBlock}${skillsBlock}${selectedSkillsBlock}${memoryBlock}${attachmentBlock}${retrievalBlock}`;
      const systemBlocks: Array<{ label: string; text: string }> = [
        { label: "Системные инструкции", text: baseSystem },
        { label: "Профиль пользователя", text: profileBlock },
        { label: "Проект", text: projectBlock },
        { label: "Каталог навыков", text: skillsBlock },
        { label: "Выбранные навыки", text: selectedSkillsBlock },
        { label: "Память", text: memoryBlock },
        { label: "Вложения", text: attachmentBlock },
        { label: "Найденный контекст (RAG)", text: retrievalBlock },
      ];

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
              allowedToolIds: filterToolIdsByPermission(
                agentRuntime?.allowedToolIds ?? [],
                input.permissionMode,
              ),
              allowedVectorStoreIds: agentRuntime?.allowedVectorStoreIds ?? [],
              retrievalLimit: agentRuntime?.retrieval_limit ?? 5,
              allowedSkillIds: agentRuntime?.allowedSkillIds ?? [],
              terminalPolicy: agentRuntime?.terminalPolicy,
              directoryPolicy: agentRuntime?.directoryPolicy,
              projectGrants: project?.grants,
            })
          : undefined;

      let continuations = 0;
      let continuationRequested = false;
      let continuationPrompt = CONTINUATION_PROMPT;
      for (let step = 0; step < maxSteps + continuations; step += 1) {
        controller.signal.throwIfAborted();
        flushContent();

        let stepMessageCount = 0;
        let stepModelId = activeModelId;
        let switchFrom = activeModelId;

        const stepResult = await runStepWithRetry({
          providers: this.providers,
          failover: this.failover,
          activeModelId,
          system,
          tools,
          abortSignal: controller.signal,
          budgetFor: (modelId) =>
            this.budgetFor(modelId, project?.compactThreshold),
          compact: async (compacted, budget, modelId) => {
            const compaction = {
              conversationId,
              runId,
              system,
              budget,
              modelId,
              protectedFromMessageId: userMessageId,
              emit,
            };
            if (compacted) await this.forceCompaction(compaction);
            else await this.compactIfNeeded(compaction);
          },
          buildMessages: (budget, modelId) => {
            stepModelId = modelId;
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
                modelId,
                usedTokens: context.tokens,
                usableTokens: budget.usable,
                compactAtTokens: budget.compactAt,
                contextLength: budget.contextLength,
                estimated: budget.estimated,
                breakdown: this.systemBreakdown(
                  systemBlocks,
                  context.tokens,
                  system,
                ),
              },
            });
            const stepMessages = continuationRequested
              ? [
                  ...context.messages,
                  { role: "user" as const, content: continuationPrompt },
                ]
              : context.messages;
            stepMessageCount = stepMessages.length;
            return stepMessages;
          },
          recoverStreamError: (error, consumed) => {
            const interrupted = consumed.interruptedToolInput;
            if (!interrupted && !isMissingFinishReasonError(error))
              return undefined;
            return {
              finishReason: "length",
              rawFinishReason: interrupted
                ? `incomplete_tool_input:${interrupted.toolName}`
                : "stream_ended_without_finish_reason",
            };
          },
          onStepComplete: (consumed) => {
            const usage = normalizeUsage(
              consumed.usage as RawUsage | undefined,
              stepModelId,
              this.providers,
            );
            if (usage) this.data.addRunUsage(runId, usage);
            this.data.addStep(
              runId,
              step,
              {
                messages: stepMessageCount,
                hasToolCalls: consumed.hasToolCalls,
                rawFinishReason: consumed.rawFinishReason,
              },
              consumed.finishReason,
              usage,
            );
          },
          onDelta: (delta) => {
            appendText("text", delta);
            emit({
              type: "text.delta",
              runId,
              messageId: assistantMessageId,
              delta,
            });
          },
          onReasoningDelta: (delta) => {
            appendText("reasoning", delta);
            emit({
              type: "reasoning.delta",
              runId,
              messageId: assistantMessageId,
              delta,
            });
          },
          onToolCall: (part) => {
            parts.push({
              type: "tool-call",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              input: (part.input ?? null) as JsonValue,
            } satisfies ChatToolCallPart);
            scheduleFlush();
          },
          onToolResult: (part) => {
            parts.push({
              type: "tool-result",
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: (part.output ?? null) as JsonValue,
              ...(part.isError ? { isError: true } : {}),
            });
            scheduleFlush();
          },
          onModelSwitch: (modelId, reason, detail, required) => {
            const change = this.failover.record(runId, {
              from: switchFrom,
              to: modelId,
              reason: reason as ModelSwitchReason,
              detail,
              ...(required?.length ? { required } : {}),
            });
            switchFrom = modelId;
            emit({
              type: "run.model.switched",
              runId,
              conversationId,
              change,
            });
          },
        });
        activeModelId = stepResult.activeModelId;
        continuationRequested = false;

        flushContent();

        const limitKind = generationLimitKind(
          stepResult.finishReason,
          stepResult.rawFinishReason,
        );
        if (limitKind) {
          if (continuations >= MAX_OUTPUT_CONTINUATIONS)
            throw new Error(limitFailureMessage(limitKind));

          continuations += 1;
          continuationRequested = true;
          continuationPrompt =
            stepResult.interruptedToolInput ||
            stepResult.rawFinishReason === "stream_ended_without_finish_reason"
              ? TOOL_INPUT_CONTINUATION_PROMPT
              : CONTINUATION_PROMPT;
          const compactedSegment =
            limitKind === "context_overflow"
              ? await this.forceCompaction({
                  conversationId,
                  runId,
                  system,
                  budget: this.budgetFor(
                    activeModelId,
                    project?.compactThreshold,
                  ),
                  modelId: activeModelId,
                  protectedFromMessageId: userMessageId,
                  emit,
                })
              : undefined;
          const wider = compactedSegment
            ? undefined
            : limitKind === "context_overflow"
              ? this.failover.widerContextModel(activeModelId)
              : this.failover.widerOutputModel(activeModelId);
          if (wider) {
            const change = this.failover.record(runId, {
              from: activeModelId,
              to: wider,
              reason: limitKind,
              detail:
                limitKind === "context_overflow"
                  ? `Контекст достиг лимита (${stepResult.rawFinishReason ?? stepResult.finishReason ?? "unknown"})`
                  : `Ответ достиг лимита (${stepResult.rawFinishReason ?? stepResult.finishReason ?? "unknown"})`,
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
        if (stepResult.hasToolCalls) continue;
        if (stepResult.finishReason === "error")
          throw new Error(
            `Провайдер остановил генерацию с ошибкой${stepResult.rawFinishReason ? `: ${stepResult.rawFinishReason}` : ""}`,
          );
        if (stepResult.finishReason === "content-filter")
          throw new Error(
            "Провайдер остановил генерацию из-за политики содержимого",
          );
        break;
      }

      controller.signal.throwIfAborted();
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
      this.tools.cleanupRun?.(runId);
      this.controllers.delete(runId);
    }
  }

  private async attachmentContextBlock(
    attachments: NonNullable<StartRunInput["attachments"]>,
    signal: AbortSignal,
  ): Promise<string> {
    if (!attachments.length) return "";
    if (!this.textExtraction) throw new Error("Обработка вложений недоступна");
    if (
      attachments.reduce((total, item) => total + item.data.byteLength, 0) >
      MAX_ATTACHMENTS_TOTAL_BYTES
    )
      throw new Error("Общий размер вложений больше 40 МБ");

    const sections: string[] = [];
    let remaining = MAX_ATTACHMENT_CONTEXT_CHARS;
    for (const attachment of attachments) {
      signal.throwIfAborted();
      if (attachment.data.byteLength > MAX_ATTACHMENT_BYTES)
        throw new Error(
          `Файл «${attachment.fileName}» больше ${MAX_ATTACHMENT_BYTES / 1_048_576} МБ`,
        );
      if (!isSupportedAttachment(attachment.fileName, attachment.mimeType))
        throw new Error(
          `Формат файла «${attachment.fileName}» не поддерживается`,
        );
      const text = (
        isPlainTextAttachment(attachment.fileName, attachment.mimeType)
          ? new TextDecoder().decode(new Uint8Array(attachment.data))
          : await this.textExtraction.extractBuffer(
              attachment.fileName,
              attachment.data.slice(0),
            )
      ).trim();
      const excerpt = text.slice(0, Math.max(0, remaining));
      remaining -= excerpt.length;
      sections.push(`### ${attachment.fileName}\n${excerpt}`);
      if (remaining <= 0) break;
    }
    return sections.length
      ? `\n\nВложения пользователя. Используй их как источник для текущего ответа:\n${sections.join("\n\n")}`
      : "";
  }

  private async retrieveVectorContext(
    runId: string,
    vectorStoreIds: string[],
    query: string,
    signal: AbortSignal,
    emit: Emit,
    parts: ChatMessageContentPart[],
  ) {
    if (!vectorStoreIds.length) return [];
    if (!this.vectorStores) throw new Error("Векторный поиск недоступен");
    signal.throwIfAborted();

    const input = { query, storeIds: vectorStoreIds, limit: 5 };
    const toolCallId = this.data.createToolCall(
      runId,
      `composer-retrieval-${newEntityId()}`,
      "vecdb_search",
      "read",
      input,
      "requested",
    );
    parts.push({
      type: "tool-call",
      toolCallId,
      toolName: "vecdb_search",
      input,
    });
    emit({
      type: "tool.requested",
      runId,
      toolCallId,
      toolId: "vecdb_search",
      input,
    });
    emit({
      type: "tool.running",
      runId,
      toolCallId,
      toolId: "vecdb_search",
    });
    try {
      const result = await this.vectorStores.search({
        vectorStoreIds,
        query,
        limit: 5,
      });
      signal.throwIfAborted();
      this.data.finishToolCall(toolCallId, "completed", result);
      parts.push({
        type: "tool-result",
        toolCallId,
        toolName: "vecdb_search",
        output: result as unknown as JsonValue,
      });
      emit({
        type: "tool.completed",
        runId,
        toolCallId,
        toolId: "vecdb_search",
        output: result,
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.data.finishToolCall(toolCallId, "failed", undefined, message);
      parts.push({
        type: "tool-result",
        toolCallId,
        toolName: "vecdb_search",
        output: { error: message },
        isError: true,
      });
      emit({
        type: "tool.completed",
        runId,
        toolCallId,
        toolId: "vecdb_search",
        error: message,
      });
      throw error;
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
    const project = this.projects.forConversation(input.conversationId);
    const segment = await this.compaction.compact({
      conversationId: input.conversationId,
      runId: input.runId,
      budget: input.budget,
      system: input.system,
      summarizerModelId: this.resolveSummarizerModelId(project, input.modelId),
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
    return segment;
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
    const project = this.projects.forConversation(input.conversationId);
    const segment = await this.compaction.compact({
      conversationId: input.conversationId,
      runId: input.runId,
      budget: input.budget,
      system: input.system,
      summarizerModelId: this.resolveSummarizerModelId(project, input.modelId),
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

function vectorContextBlock(
  results: Awaited<ReturnType<VectorStoreService["search"]>>,
): string {
  if (!results.length) return "";
  return `\n\nРелевантные фрагменты из выбранных пользователем хранилищ. Опирайся на них в ответе и не выдумывай отсутствующие факты:\n${results
    .map(
      (item, index) =>
        `[${index + 1}] ${item.fileName}${item.headingPath ? ` › ${item.headingPath}` : ""}${item.pageNumber ? `, стр. ${item.pageNumber}` : ""}\n${item.content}`,
    )
    .join("\n\n")}`;
}

const PLAIN_TEXT_FILE_PATTERN =
  /\.(txt|md|jsonl?|csv|tsx?|jsx?|mjs|cjs|py|java|kt|go|rs|c|h|cpp|hpp|cs|php|rb|swift|html?|css|scss|less|xml|ya?ml|toml|ini|sql|sh|ps1|bat|cmd|log)$/i;

function isPlainTextAttachment(fileName: string, mimeType: string) {
  return mimeType.startsWith("text/") || PLAIN_TEXT_FILE_PATTERN.test(fileName);
}

function isSupportedAttachment(fileName: string, mimeType: string) {
  return (
    isPlainTextAttachment(fileName, mimeType) || /\.(pdf|docx)$/i.test(fileName)
  );
}

function attachmentMetadataParts(
  attachments: StartRunInput["attachments"],
): ChatMessageContentPart[] {
  return (attachments ?? []).map((attachment) => ({
    type: "attachment" as const,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.data.byteLength,
  }));
}
