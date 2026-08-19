import { generateText, stepCountIs, tool } from "ai";
import type { AutomationRepository } from "../../infrastructure/database/automation.repository";
import type { EntityGenerationRepository } from "../../infrastructure/database/entity-generation.repository";
import type { ProviderRegistry } from "../../infrastructure/text-generation/provider.registry";
import type { AutomationTool } from "../../../shared/models/automation";
import type { EntityGenerationRun } from "../../../shared/models/entity-generation";
import {
  generatedAgentDraftDtoSchema,
  generatedSkillDraftDtoSchema,
  type GeneratedAgentDraft,
  type GeneratedSkillDraft,
  type StartEntityGenerationInput,
} from "../../../shared/dto";
import { DEFAULT_SKILLS } from "../../../default/skills";

const MAX_STEPS = 4;

const SKILL_SLUG_BY_KIND = {
  agent: "create-agent",
  skill: "create-skill",
} as const;

export class EntityGenerationService {
  constructor(
    private readonly runs: EntityGenerationRepository,
    private readonly automation: AutomationRepository,
    private readonly providers: ProviderRegistry,
    private readonly tools: readonly AutomationTool[],
  ) {}

  list(): EntityGenerationRun[] {
    return this.runs.list();
  }

  start(input: StartEntityGenerationInput): EntityGenerationRun {
    this.providers.resolve(input.modelId);
    const run = this.runs.create(input);
    void this.execute(run);
    return run;
  }

  private async execute(run: EntityGenerationRun): Promise<void> {
    this.runs.markRunning(run.id);
    const outcome: {
      entity: { id: string; name: string } | null;
      failure: string | null;
    } = { entity: null, failure: null };
    try {
      const result = await generateText({
        model: this.providers.resolve(run.modelId),
        ...this.providers.generationSettings(run.modelId),
        system: this.systemPrompt(run),
        prompt: `Описание от пользователя:\n\n${run.prompt}`,
        stopWhen: stepCountIs(MAX_STEPS),
        tools:
          run.kind === "agent"
            ? {
                agent_create: tool({
                  description:
                    "Сохраняет черновик нового агента. Вызывается ровно один раз.",
                  inputSchema: generatedAgentDraftDtoSchema,
                  execute: (draft: GeneratedAgentDraft) => {
                    if (outcome.entity)
                      return { ok: false, reason: "Агент уже создан" };
                    outcome.entity = capture(outcome, () =>
                      this.saveAgent(run, draft),
                    );
                    return { ok: true, ...outcome.entity };
                  },
                }),
              }
            : {
                skill_create: tool({
                  description:
                    "Сохраняет черновик нового навыка. Вызывается ровно один раз.",
                  inputSchema: generatedSkillDraftDtoSchema,
                  execute: (draft: GeneratedSkillDraft) => {
                    if (outcome.entity)
                      return { ok: false, reason: "Навык уже создан" };
                    outcome.entity = capture(outcome, () =>
                      this.saveSkill(draft),
                    );
                    return { ok: true, ...outcome.entity };
                  },
                }),
              },
      });
      if (!outcome.entity)
        throw new Error(
          outcome.failure
            ? `Не удалось сохранить результат: ${outcome.failure}`
            : result.text.trim()
              ? `Модель не вызвала инструмент сохранения. Ответ модели: ${result.text.trim().slice(0, 500)}`
              : "Модель не вызвала инструмент сохранения",
        );
      this.runs.markCompleted(run.id, outcome.entity.id, outcome.entity.name);
    } catch (error) {
      this.runs.markFailed(
        run.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private systemPrompt(run: EntityGenerationRun): string {
    const slug = SKILL_SLUG_BY_KIND[run.kind];
    const definition = DEFAULT_SKILLS.find((item) => item.slug === slug);
    if (!definition) throw new Error(`Системный навык «${slug}» не найден`);
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

  private saveAgent(
    run: EntityGenerationRun,
    draft: GeneratedAgentDraft,
  ): { id: string; name: string } {
    const known = new Set(
      this.tools.filter((item) => !item.internal).map((item) => item.id),
    );
    const agent = this.automation.upsertAgent({
      name: draft.name,
      description: draft.description,
      instructions: draft.instructions,
      textModelId: run.modelId,
      status: "draft",
      allowedToolIds: draft.allowedToolIds.filter((id) => known.has(id)),
      allowedVectorStoreIds: [],
      allowedSkillIds: [],
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
    return { id: agent.id, name: agent.name };
  }

  private saveSkill(draft: GeneratedSkillDraft): { id: string; name: string } {
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
    return { id: String(skill.id), name: skill.name };
  }
}

function capture<T>(
  outcome: { failure: string | null },
  action: () => T,
): T {
  try {
    return action();
  } catch (error) {
    outcome.failure = error instanceof Error ? error.message : String(error);
    throw error;
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
