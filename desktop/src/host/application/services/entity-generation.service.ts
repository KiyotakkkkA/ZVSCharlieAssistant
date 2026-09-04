import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { AutomationRepository } from "../../infrastructure/database/automation.repository";
import type { EntityGenerationRepository } from "../../infrastructure/database/entity-generation.repository";
import type { ScenarioGraphRepository } from "../../infrastructure/database/scenario-graph.repository";
import type { IntegrationRepository } from "../../infrastructure/database/integration.repository";
import type { VectorStoreRepository } from "../../infrastructure/database/vector-store.repository";
import type { SecretStorageRepository } from "../../infrastructure/database/secret-storage.repository";
import type { ProviderRegistry } from "../../infrastructure/text-generation/provider.registry";
import {
  ModelFailover,
  type ModelDirectory,
} from "../../infrastructure/text-generation/model-failover";
import type { UserQuestionService } from "./user-question.service";
import type { AutomationTool } from "../../../shared/models/automation";
import type {
  EntityGenerationRun,
  GenerationRunEvent,
  GenerationTranscriptMessage,
} from "../../../shared/models/entity-generation";
import type { ChatMessageContentPart } from "../../../shared/dto";
import {
  generatedAgentDraftDtoSchema,
  generatedSkillDraftDtoSchema,
  generatedScenarioApplyDtoSchema,
  type GeneratedAgentDraft,
  type GeneratedSkillDraft,
  type GeneratedScenarioApply,
  type StartEntityGenerationInput,
} from "../../../shared/dto";
import { DEFAULT_SKILLS } from "../../../default/skills";
import { ScenarioCompiler } from "../../../shared/scenario/compiler";
import {
  scenarioDescriptors,
  CATEGORY_LABELS,
} from "../../../shared/scenario/descriptors";
import { resolvePorts } from "../../../shared/scenario/node-descriptor";
import { resolveContextBudget } from "../context/context-budget";
import {
  InMemoryCompactor,
  type EnabledModelInfo,
} from "../context/generation-context";
import { runStepWithRetry } from "../context/agentic-step-loop";

const MAX_STEPS = 16;
const MAX_TRACKED_TRANSCRIPTS = 50;
const compiler = new ScenarioCompiler(scenarioDescriptors);

const SKILL_SLUG_BY_KIND = {
  agent: "create-agent",
  skill: "create-skill",
  scenario: "scenario-creation",
} as const;

const META_CREATION_SKILL_SLUGS = new Set<string>(
  Object.values(SKILL_SLUG_BY_KIND),
);

const ASK_USER_INPUT_SCHEMA = z.object({
  header: z.string().trim().max(60).optional(),
  question: z.string().trim().min(1).max(1_000),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        description: z.string().trim().max(400).optional(),
      }),
    )
    .max(4)
    .optional(),
  multiSelect: z.boolean().optional(),
});

const GET_NODE_SCHEMA_INPUT = z.object({
  kinds: z.array(z.string().trim().min(1)).min(1).max(10),
});

const RESOURCE_KIND_SCHEMA = z.enum([
  "agents",
  "vectorStores",
  "integrations",
  "scenarios",
  "secrets",
]);

const LIST_RESOURCES_INPUT = z.object({
  kind: RESOURCE_KIND_SCHEMA,
});

interface SaveOutcome {
  entityId: string;
  entityName: string;
}

export class EntityGenerationService {
  private readonly failover: ModelFailover;
  private readonly transcripts = new Map<string, InMemoryCompactor>();
  private listener?: (event: GenerationRunEvent) => void;

  constructor(
    private readonly runs: EntityGenerationRepository,
    private readonly automation: AutomationRepository,
    private readonly providers: ProviderRegistry,
    private readonly tools: readonly AutomationTool[],
    private readonly questions: UserQuestionService,
    private readonly scenarioGraphs: ScenarioGraphRepository,
    private readonly integrations: IntegrationRepository,
    private readonly vectorStores: VectorStoreRepository,
    private readonly secrets: SecretStorageRepository,
    private readonly listEnabledModels: () => EnabledModelInfo[],
  ) {
    const directory: ModelDirectory = {
      listEnabledTextModels: () => this.listEnabledModels(),
      recordModelSwitch: () => {},
    };
    this.failover = new ModelFailover(directory, this.providers);
  }

  watch(listener: (event: GenerationRunEvent) => void): void {
    this.listener = listener;
  }

  list(): EntityGenerationRun[] {
    return this.runs.list();
  }

  getTranscript(runId: string): GenerationTranscriptMessage[] {
    const compactor = this.transcripts.get(runId);
    if (!compactor) return [];
    return compactor.currentMessages.map((message) => ({
      role: message.role === "system" ? "assistant" : message.role,
      parts: message.parts,
      createdAt: message.createdAt,
    }));
  }

  start(input: StartEntityGenerationInput): EntityGenerationRun {
    this.providers.resolve(input.modelId);
    if (input.kind === "scenario" && !input.entityId)
      throw new Error("Не выбран сценарий для редактирования");
    const run = this.runs.create(input);
    void this.execute(run);
    return run;
  }

  private async execute(run: EntityGenerationRun): Promise<void> {
    this.runs.markRunning(run.id);
    this.emitRunUpdate(run.id);
    let activeModelId = run.modelId;
    const state: { outcome: SaveOutcome | null; failure: string | null } = {
      outcome: null,
      failure: null,
    };
    const compactor = new InMemoryCompactor(run.id);
    this.trackTranscript(run.id, compactor);
    compactor.appendUser([{ type: "text", text: this.initialPrompt(run) }]);
    const system = this.systemPrompt(run);

    const captureOutcome = (action: () => SaveOutcome): SaveOutcome => {
      try {
        return action();
      } catch (error) {
        state.failure = error instanceof Error ? error.message : String(error);
        throw error;
      }
    };

    const tools = this.buildTools(run, {
      onSave: (value) => {
        state.outcome = value;
      },
      capture: captureOutcome,
    });

    try {
      for (let step = 0; step < MAX_STEPS && !state.outcome; step += 1) {
        const stepResult = await runStepWithRetry({
          providers: this.providers,
          failover: this.failover,
          activeModelId,
          system,
          tools,
          maxOutputTokens: Infinity,
          abortSignal: new AbortController().signal,
          budgetFor: (modelId) =>
            resolveContextBudget({
              contextLength: this.providers.modelInfo(modelId).contextLength,
              maxOutputTokens:
                this.providers.generationSettings(modelId).maxOutputTokens,
            }),
          buildMessages: (budget) =>
            compactor.buildStepContext(system, budget).messages,
          compact: (compacted, budget) => {
            if (!compacted && !compactor.shouldCompact(system, budget))
              return Promise.resolve();
            return compactor
              .compact({
                providers: this.providers,
                listEnabledModels: this.listEnabledModels,
                summarizerModelId: activeModelId,
                reason: compacted ? "overflow" : "threshold",
              })
              .then(() => undefined);
          },
          onDelta: (delta) =>
            this.emit({ type: "text.delta", runId: run.id, delta }),
          onReasoningDelta: (delta) =>
            this.emit({ type: "reasoning.delta", runId: run.id, delta }),
          onToolCall: ({ toolCallId, toolName, input }) =>
            this.emit({
              type: "tool.call",
              runId: run.id,
              toolCallId,
              toolName,
              input,
            }),
          onToolResult: ({ toolCallId, toolName, output, isError }) =>
            this.emit({
              type: "tool.result",
              runId: run.id,
              toolCallId,
              toolName,
              output,
              isError,
            }),
        });
        activeModelId = stepResult.activeModelId;

        const assistantParts: ChatMessageContentPart[] = [
          ...(stepResult.reasoning.trim()
            ? [{ type: "reasoning" as const, text: stepResult.reasoning }]
            : []),
          ...(stepResult.text.trim()
            ? [{ type: "text" as const, text: stepResult.text }]
            : []),
          ...stepResult.toolCallParts,
        ];
        const resultParts = stepResult.resultParts;

        if (assistantParts.length || resultParts.length)
          compactor.appendAssistant([...assistantParts, ...resultParts]);
        this.emit({ type: "step.completed", runId: run.id });
      }

      if (!state.outcome)
        throw new Error(
          state.failure
            ? `Не удалось сохранить результат: ${state.failure}`
            : "Модель не вызвала инструмент сохранения за отведённое число шагов",
        );
      this.runs.markCompleted(
        run.id,
        state.outcome.entityId,
        state.outcome.entityName,
      );
      this.emitRunUpdate(run.id);
    } catch (error) {
      this.runs.markFailed(
        run.id,
        error instanceof Error ? error.message : String(error),
      );
      this.emitRunUpdate(run.id);
    }
  }

  private emit(event: GenerationRunEvent): void {
    this.listener?.(event);
  }

  private emitRunUpdate(runId: string): void {
    const run = this.runs.find(runId);
    if (run) this.emit({ type: "run.updated", run });
  }

  private trackTranscript(runId: string, compactor: InMemoryCompactor): void {
    this.transcripts.set(runId, compactor);
    if (this.transcripts.size <= MAX_TRACKED_TRANSCRIPTS) return;
    const oldest = this.transcripts.keys().next().value;
    if (oldest) this.transcripts.delete(oldest);
  }

  private initialPrompt(run: EntityGenerationRun): string {
    if (run.kind !== "scenario")
      return `Описание от пользователя:\n\n${run.prompt}`;
    const existing = run.entityId
      ? this.scenarioGraphs.find(run.entityId)
      : undefined;
    const currentGraph = existing
      ? JSON.stringify(existing.graph)
      : "(сценарий пуст)";
    return `Текущий граф сценария (JSON):\n\n${currentGraph}\n\nЗапрос пользователя на изменение:\n\n${run.prompt}`;
  }

  private buildTools(
    run: EntityGenerationRun,
    hooks: {
      onSave: (value: SaveOutcome) => void;
      capture: (action: () => SaveOutcome) => SaveOutcome;
    },
  ): ToolSet {
    const askUser = tool({
      description:
        "Задаёт пользователю уточняющий вопрос, если без ответа продолжать нельзя. Используй умеренно — максимум 1-2 раза за генерацию, только когда решение действительно неоднозначно.",
      inputSchema: ASK_USER_INPUT_SCHEMA,
      execute: async (input) => {
        this.runs.markClarificationRequested(run.id);
        this.emitRunUpdate(run.id);
        const answer = await this.questions.askInGeneration(
          {
            mode: input.options?.length ? "choice" : "text",
            header: input.header ?? "Уточнение",
            question: input.question,
            options: input.options ?? [],
            multiSelect: Boolean(input.multiSelect),
          },
          { entityGenerationRunId: run.id },
        );
        this.runs.markRunning(run.id);
        this.emitRunUpdate(run.id);
        return { answer };
      },
    });

    if (run.kind === "agent")
      return {
        agent_create: tool({
          description:
            "Сохраняет черновик нового агента. Вызывается ровно один раз.",
          inputSchema: generatedAgentDraftDtoSchema,
          execute: (draft: GeneratedAgentDraft) => {
            const saved = hooks.capture(() => this.saveAgent(run, draft));
            hooks.onSave(saved);
            return { ok: true, ...saved };
          },
        }),
        ask_user: askUser,
      };

    if (run.kind === "skill")
      return {
        skill_create: tool({
          description:
            "Сохраняет черновик нового навыка. Вызывается ровно один раз.",
          inputSchema: generatedSkillDraftDtoSchema,
          execute: (draft: GeneratedSkillDraft) => {
            const saved = hooks.capture(() => this.saveSkill(draft));
            hooks.onSave(saved);
            return { ok: true, ...saved };
          },
        }),
        ask_user: askUser,
      };

    return {
      scenario_apply: tool({
        description:
          "Применяет новый граф сценария (полностью заменяет текущий). Обязательно вызови, когда граф готов.",
        inputSchema: generatedScenarioApplyDtoSchema,
        execute: (input: GeneratedScenarioApply) => {
          const result = compiler.validate(input.graph);
          const errors = result.issues
            .filter((issue) => issue.severity === "error")
            .map((issue) => issue.message);
          if (errors.length) return { ok: false, errors };
          const saved = hooks.capture(() => this.saveScenario(run, input));
          hooks.onSave(saved);
          return { ok: true, summary: input.summary };
        },
      }),
      get_node_schema: tool({
        description:
          "Возвращает точную схему конфигурации, порты и особые правила для указанных видов узлов. Вызывай перед тем, как впервые настраиваешь узел этого вида в этой генерации — угадывать поля не нужно.",
        inputSchema: GET_NODE_SCHEMA_INPUT,
        execute: ({ kinds }) => ({
          nodes: kinds.map((kind) => this.describeNodeSchema(kind)),
        }),
      }),
      list_resources: tool({
        description:
          "Возвращает реальные идентификаторы, существующие в системе сейчас: агенты, хранилища знаний, подключения Telegram/почты, другие сценарии или секреты. Вызывай перед тем, как поставить такой идентификатор в конфиг узла — никогда не придумывай его.",
        inputSchema: LIST_RESOURCES_INPUT,
        execute: ({ kind }) => this.listResources(kind, run.entityId),
      }),
      ask_user: askUser,
    };
  }

  private systemPrompt(run: EntityGenerationRun): string {
    const slug = SKILL_SLUG_BY_KIND[run.kind];
    const definition = DEFAULT_SKILLS.find((item) => item.slug === slug);
    if (!definition) throw new Error(`Системный навык «${slug}» не найден`);
    if (run.kind === "scenario")
      return `${definition.instructions}\n\n${this.scenarioNodeIndex()}`;
    if (run.kind === "agent")
      return `${definition.instructions}\n\n${this.toolCatalog()}\n\n${this.skillCatalog()}`;
    return `${definition.instructions}\n\n${this.toolCatalog()}`;
  }

  private toolCatalog(): string {
    const available = this.tools.filter((item) => !item.internal);
    if (!available.length)
      return "## Каталог инструментов\n\nДоступных инструментов нет — передавай пустой список.";
    const lines = available.map(
      (item) => `- \`${item.id}\` — ${item.name}. ${item.description}`,
    );
    return `## Каталог инструментов\n\nРазрешено использовать только эти идентификаторы:\n\n${lines.join("\n")}`;
  }

  private skillCatalog(): string {
    const available = this.automation
      .listSkills()
      .filter((item) => !META_CREATION_SKILL_SLUGS.has(item.slug));
    if (!available.length)
      return "## Каталог навыков\n\nДоступных навыков нет — передавай пустой список.";
    const lines = available.map(
      (item) => `- \`${item.id}\` — ${item.name}. ${item.description}`,
    );
    return `## Каталог навыков\n\nПереиспользуемые инструкции, которые агент может подключить. Разрешено использовать только эти идентификаторы, и только когда роль реально в них нуждается:\n\n${lines.join("\n")}`;
  }

  private scenarioNodeIndex(): string {
    const sections: string[] = [
      "## Виды узлов сценария",
      "Это только список названий — вызови `get_node_schema` с нужными видами, чтобы получить точные поля конфигурации, порты и особые правила перед тем, как впервые настраиваешь узел этого вида. Идентификаторы для полей вроде `agentId`/`vectorStoreId`/`integrationProfileId`/`scenarioId`/`authSecretId` бери через `list_resources` — никогда не придумывай их.",
    ];
    for (const category of scenarioDescriptors.byCategory()) {
      sections.push(
        `\n### ${CATEGORY_LABELS[category.category] ?? category.category}`,
      );
      for (const descriptor of category.items)
        sections.push(
          `- \`${descriptor.kind}\` (${descriptor.label}) — ${descriptor.description}`,
        );
    }
    return sections.join("\n");
  }

  private describeNodeSchema(kind: string): unknown {
    const descriptor = scenarioDescriptors.get(kind);
    if (!descriptor) return { kind, error: "Неизвестный вид узла" };
    const defaultConfig = descriptor.defaultConfig?.() ?? {};
    return {
      kind: descriptor.kind,
      label: descriptor.label,
      category: descriptor.category,
      description: descriptor.description,
      documentation: descriptor.documentation ?? null,
      isTrigger: Boolean(descriptor.isTrigger),
      isTerminal: Boolean(descriptor.isTerminal),
      allowsLoopBack: Boolean(descriptor.allowsLoopBack),
      maxPerScenario: descriptor.maxPerScenario ?? null,
      itemMode: descriptor.itemMode,
      inputs: resolvePorts(descriptor.inputs, defaultConfig),
      outputs: resolvePorts(descriptor.outputs, defaultConfig),
      portsNote:
        typeof descriptor.inputs === "function" ||
        typeof descriptor.outputs === "function"
          ? "Порты этого узла зависят от конфигурации — показаны для конфигурации по умолчанию, реальный набор может отличаться."
          : undefined,
      configSchema: cleanJsonSchema(
        z.toJSONSchema(descriptor.configSchema as z.ZodType, {
          unrepresentable: "any",
        }),
      ),
    };
  }

  private listResources(
    kind: z.infer<typeof RESOURCE_KIND_SCHEMA>,
    currentScenarioId: string | null,
  ): unknown {
    if (kind === "agents")
      return this.automation.listAgents().map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      }));
    if (kind === "vectorStores")
      return this.vectorStores.snapshot().stores.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
      }));
    if (kind === "integrations")
      return this.integrations
        .listProfiles()
        .filter(
          (item) => item.kind === "telegram_bot" || item.kind === "email_imap",
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          channel: item.kind === "telegram_bot" ? "telegram" : "email",
          status: item.status,
        }));
    if (kind === "scenarios")
      return this.scenarioGraphs
        .list()
        .filter((item) => item.id !== currentScenarioId)
        .map((item) => ({ id: item.id, name: item.name }));
    const snapshot = this.secrets.getSnapshot();
    const categoryLabelById = new Map(
      snapshot.categories.map((item) => [item.id, item.label]),
    );
    return snapshot.secrets.map((item) => ({
      id: item.id,
      label: item.label,
      category: categoryLabelById.get(item.categoryId) ?? "секрет",
    }));
  }

  private saveAgent(
    run: EntityGenerationRun,
    draft: GeneratedAgentDraft,
  ): SaveOutcome {
    const known = new Set(
      this.tools.filter((item) => !item.internal).map((item) => item.id),
    );
    const knownSkills = new Set(
      this.automation
        .listSkills()
        .filter((item) => !META_CREATION_SKILL_SLUGS.has(item.slug))
        .map((item) => item.id),
    );
    const agent = this.automation.upsertAgent({
      name: draft.name,
      description: draft.description,
      instructions: draft.instructions,
      textModelId: run.modelId,
      status: "draft",
      allowedToolIds: draft.allowedToolIds.filter((id) => known.has(id)),
      allowedVectorStoreIds: [],
      allowedSkillIds: draft.allowedSkillIds.filter((id) =>
        knownSkills.has(id),
      ),
      memoryRead: draft.memoryRead,
      memoryWrite: draft.memoryWrite,
      retrievalLimit: draft.retrievalLimit,
      maxToolCalls: draft.maxToolCalls,
      timeoutSeconds: draft.timeoutSeconds,
      terminalPolicy: {
        enabled: false,
        confirmationMode: "always",
        timeoutSeconds: 60,
        allowedCommands: [],
      },
      directoryPolicy: { grants: [] },
    });
    return { entityId: agent.id, entityName: agent.name };
  }

  private saveSkill(draft: GeneratedSkillDraft): SaveOutcome {
    const known = new Set(
      this.tools.filter((item) => !item.internal).map((item) => item.id),
    );
    const skill = this.automation.upsertSkill({
      slug: uniqueSlug(draft.slug, (slug) =>
        this.automation.listSkills().some((item) => item.slug === slug),
      ),
      name: draft.name,
      description: draft.description,
      status: "draft",
      version: draft.version || "1.0.0",
      author: "Генерация",
      instructions: draft.instructions,
      requiredToolIds: draft.requiredToolIds.filter((id) => known.has(id)),
    });
    return { entityId: String(skill.id), entityName: skill.name };
  }

  private saveScenario(
    run: EntityGenerationRun,
    input: GeneratedScenarioApply,
  ): SaveOutcome {
    if (!run.entityId) throw new Error("Не выбран сценарий для редактирования");
    const existing = this.scenarioGraphs.find(run.entityId);
    const saved = this.scenarioGraphs.upsert({
      id: run.entityId,
      name: existing?.name ?? "Сценарий",
      description: existing?.description ?? "Сценарий автоматизации.",
      status: "draft",
      graph: input.graph,
      toolSettings: existing?.toolSettings ?? [],
    });
    return { entityId: saved.id, entityName: saved.name };
  }
}

function uniqueSlug(source: string, taken: (slug: string) => boolean): string {
  const base =
    source
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "generated-skill";
  if (!taken(base)) return base;
  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!taken(candidate)) return candidate;
  }
  throw new Error("Не удалось подобрать свободный идентификатор навыка");
}

function cleanJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanJsonSchema);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, val]) =>
      key !== "$schema" &&
      key !== "additionalProperties" &&
      !(
        key === "pattern" &&
        typeof val === "string" &&
        val.includes("0-9a-fA-F")
      ),
  );
  return Object.fromEntries(
    entries.map(([key, val]) => [key, cleanJsonSchema(val)]),
  );
}
