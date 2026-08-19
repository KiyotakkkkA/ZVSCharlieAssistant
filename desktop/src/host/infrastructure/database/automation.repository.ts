import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
  AutomationAgent,
  AutomationSnapshot,
  AutomationTool,
  AutomationSkill,
} from "../../../shared/models/automation";
import {
  agentTerminalPolicyDtoSchema,
  agentDirectoryPolicyDtoSchema,
  parseJsonDto,
  stringArrayDtoSchema,
  type UpsertAutomationAgentInput,
  type UpsertAutomationSkillInput,
  type UpsertAutomationToolSecretBindingInput,
  type AutomationStatus,
  type TerminalConfirmationMode,
  type DirectoryGrant,
} from "../../../shared/dto";

import type { SkillContentStore } from "../../application/ports/automation-runtime.ports";
import { TerminalPolicyRepository } from "./terminal-policy.repository";
import { DirectoryPolicyRepository } from "./directory-policy.repository";

interface AgentRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  text_model_id: number | null;
  status: AutomationAgent["status"];
  max_tool_calls: number;
  timeout_seconds: number;
  runs: number;
  updated_at: string;
  retrieval_limit: number;
  terminal_policy_json: string;
  directory_policy_json: string;
  memory_read: number;
  memory_write: number;
}


const STATUSES = new Set<AutomationStatus>(["draft", "active", "disabled"]);

const normalizeText = (
  value: string,
  label: string,
  maxLength: number,
): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} не может быть пустым`);
  if (normalized.length > maxLength)
    throw new Error(`${label} не может быть длиннее ${maxLength} символов`);
  return normalized;
};

const normalizeIds = (values: string[]): string[] => [
  ...new Set(values.map((v) => v.trim()).filter(Boolean)),
];

const assertPositiveInteger = (value: number, label: string, max: number) => {
  if (!Number.isInteger(value) || value <= 0 || value > max)
    throw new Error(`${label} имеет недопустимое значение`);
};

const stricterConfirmationMode = (
  first: TerminalConfirmationMode,
  second: TerminalConfirmationMode,
): TerminalConfirmationMode => {
  const rank: Record<TerminalConfirmationMode, number> = {
    policy: 0,
    risky: 1,
    always: 2,
  };
  return rank[first] >= rank[second] ? first : second;
};

export class AutomationRepository {
  private readonly toolsById: ReadonlyMap<string, AutomationTool>;

  constructor(
    private readonly database: Database.Database,
    private readonly tools: readonly AutomationTool[],
    private readonly skillContent: SkillContentStore,
    private readonly terminalPolicies: TerminalPolicyRepository,
    private readonly directoryPolicies: DirectoryPolicyRepository,
  ) {
    this.toolsById = new Map(tools.map((tool) => [tool.id, tool]));
  }

  getSnapshot(): Omit<AutomationSnapshot, "scenarios"> {
    return {
      tools: this.tools
        .filter((tool) => !tool.internal)
        .map((tool) => this.mapTool(tool)),
      agents: this.listAgents(),
      skills: this.listSkillsFull(),
    };
  }

  listToolSecretBindings(toolId: string) {
    return this.database
      .prepare(
        `SELECT binding_key, secret_id
         FROM automation_tool_secret_bindings WHERE tool_id=? ORDER BY binding_key`,
      )
      .all(toolId) as Array<{ binding_key: string; secret_id: number }>;
  }

  toolSecretId(toolId: string, key: string) {
    return (
      this.database
        .prepare(
          "SELECT secret_id FROM automation_tool_secret_bindings WHERE tool_id=? AND binding_key=?",
        )
        .get(toolId, key) as { secret_id: number } | undefined
    )?.secret_id;
  }

  upsertToolSecretBinding(
    input: UpsertAutomationToolSecretBindingInput,
  ): AutomationTool {
    const tool = this.toolsById.get(input.toolId);
    if (!tool) throw new Error("Инструмент не найден");

    const requirement = tool.secretRequirements.find(
      (item) => item.key === input.key,
    );
    if (!requirement)
      throw new Error("Привязка секрета не поддерживается инструментом");

    if (
      input.secretId !== null &&
      (!Number.isInteger(input.secretId) ||
        !this.secretExistsInCategory(input.secretId, requirement.categoryId))
    ) {
      throw new Error("Секрет не существует или относится к другой категории");
    }

    if (input.secretId === null) {
      this.database
        .prepare(
          "DELETE FROM automation_tool_secret_bindings WHERE tool_id=? AND binding_key=?",
        )
        .run(input.toolId, input.key);
    } else {
      this.database
        .prepare(
          `INSERT INTO automation_tool_secret_bindings(tool_id,binding_key,secret_id)
           VALUES(?,?,?) ON CONFLICT(tool_id,binding_key)
           DO UPDATE SET secret_id=excluded.secret_id`,
        )
        .run(input.toolId, input.key, input.secretId);
    }

    return this.mapTool(tool);
  }

  secretExistsInCategory(id: number, categoryId: number): boolean {
    return Boolean(
      this.database
        .prepare("SELECT 1 FROM secret_entities WHERE id=? AND category_id=?")
        .get(id, categoryId),
    );
  }

  listAgents(): AutomationAgent[] {
    const rows = this.database
      .prepare(
        `SELECT id, name, description, instructions, text_model_id, status,
                max_tool_calls, timeout_seconds, runs, updated_at, retrieval_limit, 
                terminal_policy_json, directory_policy_json, memory_read, memory_write
         FROM automation_agents
         ORDER BY updated_at DESC, name ASC`,
      )
      .all() as AgentRow[];

    const toolsByAgent = new Map<string, string[]>();
    for (const item of this.database
      .prepare(
        "SELECT agent_id,tool_id FROM automation_agent_tools ORDER BY tool_id",
      )
      .all() as Array<{ agent_id: string; tool_id: string }>) {
      const values = toolsByAgent.get(item.agent_id) ?? [];
      values.push(item.tool_id);
      toolsByAgent.set(item.agent_id, values);
    }

    const storesByAgent = new Map<string, number[]>();
    for (const item of this.database
      .prepare(
        "SELECT agent_id,vector_store_id FROM automation_agent_vector_stores ORDER BY vector_store_id",
      )
      .all() as Array<{ agent_id: string; vector_store_id: number }>) {
      const values = storesByAgent.get(item.agent_id) ?? [];
      values.push(item.vector_store_id);
      storesByAgent.set(item.agent_id, values);
    }

    const skillsByAgent = new Map<string, number[]>();
    for (const item of this.database
      .prepare(
        "SELECT agent_id,skill_id FROM automation_agent_skills ORDER BY skill_id",
      )
      .all() as Array<{ agent_id: string; skill_id: number }>) {
      const values = skillsByAgent.get(item.agent_id) ?? [];
      values.push(item.skill_id);
      skillsByAgent.set(item.agent_id, values);
    }

    return rows.map((row) =>
      this.mapAgent(
        row,
        toolsByAgent.get(row.id) ?? [],
        storesByAgent.get(row.id) ?? [],
        skillsByAgent.get(row.id) ?? [],
      ),
    );
  }

  findAgent(id: string): AutomationAgent | undefined {
    const row = this.database
      .prepare(
        `SELECT id, name, description, instructions, text_model_id, status,
                max_tool_calls, timeout_seconds, runs, updated_at, retrieval_limit, 
                terminal_policy_json, directory_policy_json, memory_read, memory_write
         FROM automation_agents WHERE id = ?`,
      )
      .get(id) as AgentRow | undefined;
    return row ? this.mapAgent(row) : undefined;
  }

  upsertAgent(input: UpsertAutomationAgentInput): AutomationAgent {
    if (!STATUSES.has(input.status))
      throw new Error("Недопустимый статус агента");
    assertPositiveInteger(input.maxToolCalls, "Лимит инструментов", 10_000);
    assertPositiveInteger(input.timeoutSeconds, "Таймаут", 86_400);
    assertPositiveInteger(input.retrievalLimit, "Лимит поиска", 20);

    const textModelId = input.textModelId;
    if (!Number.isInteger(textModelId) || textModelId <= 0)
      throw new Error("Некорректная модель");
    if (!this.textModelExists(textModelId))
      throw new Error("Выбранная модель недоступна");

    const allowedToolIds = normalizeIds(input.allowedToolIds);
    this.assertToolsExist(allowedToolIds);

    const allowedVectorStoreIds = allowedToolIds.includes("vecdb_search")
      ? [...new Set(input.allowedVectorStoreIds)]
      : [];
    for (const storeId of allowedVectorStoreIds) {
      if (!Number.isInteger(storeId) || storeId < 1)
        throw new Error("Некорректный идентификатор векторного хранилища");
      if (!this.vectorStoreExists(storeId))
        throw new Error(`Векторное хранилище #${storeId} недоступно`);
    }

    const allowedSkillIds = [...new Set(input.allowedSkillIds)];
    const skillsById = new Map(this.listSkillsFull().map((s) => [s.id, s]));
    for (const skillId of allowedSkillIds) {
      const skill = skillsById.get(skillId);
      if (!Number.isInteger(skillId) || !skill)
        throw new Error(`Навык #${skillId} не найден`);
      if (skill.status !== "active")
        throw new Error(`Навык «${skill.name}» не активен`);
      const missingTool = skill.requiredToolIds.find(
        (tid) => !allowedToolIds.includes(tid),
      );
      if (missingTool)
        throw new Error(
          `Для навыка «${skill.name}» разрешите инструмент ${missingTool}`,
        );
    }

    const id = input.id ?? randomUUID();
    if (input.id && !this.findAgent(input.id))
      throw new Error("Агент не найден");

    const globalTerminal = this.terminalPolicies.get();
    const requestedTerminal = input.terminalPolicy;
    const globalCommands = new Set(
      globalTerminal.allowedCommands.map((c) => c.toLowerCase()),
    );

    const terminalPolicy = {
      enabled:
        globalTerminal.enabled &&
        allowedToolIds.includes("cmd_exec") &&
        requestedTerminal.enabled,
      confirmationMode: stricterConfirmationMode(
        globalTerminal.confirmationMode,
        requestedTerminal.confirmationMode,
      ),
      timeoutSeconds: Math.min(
        Math.max(requestedTerminal.timeoutSeconds, 1),
        globalTerminal.maxTimeoutSeconds,
      ),
      allowedCommands: requestedTerminal.allowedCommands.filter((c) =>
        globalCommands.has(c.toLowerCase()),
      ),
    };

    const globalDirectories = new Map(
      this.directoryPolicies.get().grants.map((g) => [g.path.toLowerCase(), g]),
    );
    const directoryPolicy = {
      grants: input.directoryPolicy.grants.flatMap((requested) => {
        const global = globalDirectories.get(requested.path.toLowerCase());
        if (!global) return [];
        return [
          {
            path: global.path,
            recursive: global.recursive && requested.recursive,
            permissions: requested.permissions.filter((p) =>
              global.permissions.includes(p),
            ),
          } satisfies DirectoryGrant,
        ];
      }),
    };

    const normalizedInput: UpsertAutomationAgentInput = {
      ...input,
      id,
      name: normalizeText(input.name, "Название", 120),
      description: normalizeText(input.description, "Описание", 500),
      instructions: normalizeText(input.instructions, "Инструкции", 50_000),
      textModelId,
      allowedToolIds,
      allowedVectorStoreIds,
      allowedSkillIds,
      terminalPolicy,
      directoryPolicy,
    };

    this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO automation_agents (
             id, name, description, instructions, text_model_id, status,
             max_tool_calls, timeout_seconds, retrieval_limit, terminal_policy_json, directory_policy_json,
             memory_read, memory_write
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name, description = excluded.description,
             instructions = excluded.instructions, text_model_id = excluded.text_model_id,
             status = excluded.status, max_tool_calls = excluded.max_tool_calls,
             timeout_seconds = excluded.timeout_seconds, retrieval_limit = excluded.retrieval_limit,
             terminal_policy_json = excluded.terminal_policy_json,
             directory_policy_json = excluded.directory_policy_json,
             memory_read = excluded.memory_read, memory_write = excluded.memory_write,
             updated_at = CURRENT_TIMESTAMP`,
        )
        .run(
          id,
          normalizedInput.name,
          normalizedInput.description,
          normalizedInput.instructions,
          normalizedInput.textModelId,
          normalizedInput.status,
          normalizedInput.maxToolCalls,
          normalizedInput.timeoutSeconds,
          normalizedInput.retrievalLimit,
          JSON.stringify(normalizedInput.terminalPolicy),
          JSON.stringify(normalizedInput.directoryPolicy),
          Number(normalizedInput.memoryRead),
          Number(normalizedInput.memoryWrite),
        );

      this.database
        .prepare("DELETE FROM automation_agent_tools WHERE agent_id = ?")
        .run(id);
      const insertTool = this.database.prepare(
        "INSERT INTO automation_agent_tools (agent_id, tool_id) VALUES (?, ?)",
      );
      for (const toolId of allowedToolIds) insertTool.run(id, toolId);

      this.database
        .prepare("DELETE FROM automation_agent_vector_stores WHERE agent_id=?")
        .run(id);
      const insertStore = this.database.prepare(
        "INSERT INTO automation_agent_vector_stores(agent_id,vector_store_id) VALUES(?,?)",
      );
      for (const storeId of allowedVectorStoreIds) insertStore.run(id, storeId);

      this.database
        .prepare("DELETE FROM automation_agent_skills WHERE agent_id=?")
        .run(id);
      const insertSkill = this.database.prepare(
        "INSERT INTO automation_agent_skills(agent_id,skill_id) VALUES(?,?)",
      );
      for (const skillId of allowedSkillIds) insertSkill.run(id, skillId);
    })();

    return this.findAgent(id)!;
  }

  deleteAgent(id: string): void {
    const result = this.database
      .prepare("DELETE FROM automation_agents WHERE id = ?")
      .run(normalizeText(id, "Идентификатор", 120));
    if (result.changes === 0) throw new Error("Агент не найден");
  }

  textModelExists(id: number): boolean {
    return Boolean(
      this.database
        .prepare(
          "SELECT 1 FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id WHERE m.id=? AND m.enabled=1 AND p.enabled=1 AND p.provider_type='text'",
        )
        .get(id),
    );
  }

  vectorStoreExists(id: number): boolean {
    return Boolean(
      this.database
        .prepare(
          "SELECT 1 FROM vector_stores WHERE id=? AND embedding_model_id IS NOT NULL AND status!='disabled'",
        )
        .get(id),
    );
  }

  listSkills(): Omit<AutomationSkill, "instructions">[] {
    return (
      this.database
        .prepare(
          `SELECT s.id,s.slug,s.name,s.description,s.status,s.version,s.author,s.builtin,
                  s.required_tool_ids_json,s.updated_at,COUNT(a.agent_id) assigned_agents_count
           FROM automation_skills s
           LEFT JOIN automation_agent_skills a ON a.skill_id=s.id
           GROUP BY s.id ORDER BY s.updated_at DESC,s.name ASC`,
        )
        .all() as Array<Record<string, unknown>>
    ).map((row) => ({
      id: Number(row.id),
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description),
      status: row.status as AutomationSkill["status"],
      version: String(row.version),
      author: String(row.author),
      requiredToolIds: parseJsonDto(
        stringArrayDtoSchema,
        String(row.required_tool_ids_json),
      ),
      assignedAgentsCount: Number(row.assigned_agents_count),
      updatedAt: String(row.updated_at),
      builtin: Boolean(row.builtin),
    }));
  }

  private listSkillsFull(): AutomationSkill[] {
    return this.listSkills().map((skill) => ({
      ...skill,
      instructions: this.skillContent.read(skill.slug),
    }));
  }

  findSkill(id: number): Omit<AutomationSkill, "instructions"> | undefined {
    const row = this.database
      .prepare(
        `SELECT s.id,s.slug,s.name,s.description,s.status,s.version,s.author,s.builtin,
                s.required_tool_ids_json,s.updated_at,COUNT(a.agent_id) assigned_agents_count
         FROM automation_skills s
         LEFT JOIN automation_agent_skills a ON a.skill_id=s.id
         WHERE s.id=? GROUP BY s.id`,
      )
      .get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: Number(row.id),
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description),
      status: row.status as AutomationSkill["status"],
      version: String(row.version),
      author: String(row.author),
      requiredToolIds: parseJsonDto(
        stringArrayDtoSchema,
        String(row.required_tool_ids_json),
      ),
      assignedAgentsCount: Number(row.assigned_agents_count),
      updatedAt: String(row.updated_at),
      builtin: Boolean(row.builtin),
    };
  }

  upsertSkill(
    input: UpsertAutomationSkillInput,
  ): Omit<AutomationSkill, "instructions"> {
    if (!STATUSES.has(input.status))
      throw new Error("Недопустимый статус навыка");

    const previous = input.id
      ? this.listSkillsFull().find((skill) => skill.id === input.id)
      : undefined;
    if (previous?.builtin)
      throw new Error("Системный навык доступен только для чтения");

    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      throw new Error(
        "Slug может содержать строчные латинские буквы, цифры и дефисы",
      );

    const requiredToolIds = normalizeIds(input.requiredToolIds);
    this.assertToolsExist(requiredToolIds);

    const normalized: UpsertAutomationSkillInput = {
      ...input,
      slug,
      name: normalizeText(input.name, "Название", 120),
      description: normalizeText(input.description, "Описание", 500),
      instructions: normalizeText(input.instructions, "Инструкции", 50_000),
      version: normalizeText(input.version, "Версия", 30),
      author: input.author.trim().slice(0, 120),
      requiredToolIds,
    };

    let skill: Omit<AutomationSkill, "instructions">;

    if (normalized.id) {
      const result = this.database
        .prepare(
          `UPDATE automation_skills SET slug=?,name=?,description=?,status=?,version=?,author=?,required_tool_ids_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        )
        .run(
          normalized.slug,
          normalized.name,
          normalized.description,
          normalized.status,
          normalized.version,
          normalized.author,
          JSON.stringify(normalized.requiredToolIds),
          normalized.id,
        );
      if (!result.changes) throw new Error("Навык не найден");
      skill = this.findSkill(normalized.id)!;
    } else {
      const inserted = this.database
        .prepare(
          `INSERT INTO automation_skills(slug,name,description,status,version,author,required_tool_ids_json) VALUES(?,?,?,?,?,?,?)`,
        )
        .run(
          normalized.slug,
          normalized.name,
          normalized.description,
          normalized.status,
          normalized.version,
          normalized.author,
          JSON.stringify(normalized.requiredToolIds),
        );
      skill = this.findSkill(Number(inserted.lastInsertRowid))!;
    }

    try {
      this.skillContent.write(slug, normalized, normalized.instructions);
      if (previous && previous.slug !== slug)
        this.skillContent.remove(previous.slug);
    } catch (error) {
      if (!input.id) this.deleteSkill(skill.id);
      throw error;
    }

    return skill;
  }

  ensureBuiltinSkill(
    input: Omit<UpsertAutomationSkillInput, "id" | "instructions">,
  ): number {
    const existing = this.database
      .prepare("SELECT id FROM automation_skills WHERE slug=?")
      .get(input.slug) as { id: number } | undefined;
    if (existing) {
      this.database
        .prepare(
          `UPDATE automation_skills SET name=?,description=?,status='active',version=?,author=?,builtin=1,required_tool_ids_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        )
        .run(
          input.name,
          input.description,
          input.version,
          input.author,
          JSON.stringify(input.requiredToolIds),
          existing.id,
        );
      return existing.id;
    }
    return Number(
      this.database
        .prepare(
          `INSERT INTO automation_skills(slug,name,description,status,version,author,builtin,required_tool_ids_json) VALUES(?,?,?,'active',?,?,1,?)`,
        )
        .run(
          input.slug,
          input.name,
          input.description,
          input.version,
          input.author,
          JSON.stringify(input.requiredToolIds),
        ).lastInsertRowid,
    );
  }

  deleteSkill(id: number): void {
    const skill = this.listSkillsFull().find((item) => item.id === id);
    if (!skill) throw new Error("Навык не найден");
    if (skill.builtin) throw new Error("Системный навык нельзя удалить");

    const result = this.database
      .prepare("DELETE FROM automation_skills WHERE id=?")
      .run(id);
    if (!result.changes) throw new Error("Навык не найден");
    this.skillContent.remove(skill.slug);
  }

  private assertToolsExist(toolIds: string[]): void {
    for (const toolId of toolIds) {
      const tool = this.toolsById.get(toolId);
      if (!tool) throw new Error(`Инструмент ${toolId} не зарегистрирован`);
      if (!this.mapTool(tool).enabled)
        throw new Error(`Инструмент ${toolId} не настроен или отключён`);
    }
  }

  private mapTool(tool: AutomationTool): AutomationTool {
    const secretBindings = this.listToolSecretBindings(tool.id).map(
      (binding) => ({
        key: binding.binding_key,
        secretId: binding.secret_id,
      }),
    );
    return {
      ...tool,
      inputSchema: { ...tool.inputSchema },
      outputSchema: { ...tool.outputSchema },
      secretRequirements: tool.secretRequirements.map((r) => ({ ...r })),
      enabled:
        tool.enabled &&
        (tool.id !== "cmd_exec" || this.terminalPolicies.get().enabled) &&
        tool.secretRequirements
          .filter((r) => r.required)
          .every((r) => secretBindings.some((b) => b.key === r.key)),
      secretBindings,
    };
  }

  private mapAgent(
    row: AgentRow,
    toolIds?: string[],
    vectorStoreIds?: number[],
    skillIds?: number[],
  ): AutomationAgent {
    const allowedToolIds =
      toolIds ??
      (
        this.database
          .prepare(
            "SELECT tool_id FROM automation_agent_tools WHERE agent_id = ? ORDER BY tool_id",
          )
          .all(row.id) as Array<{ tool_id: string }>
      ).map(({ tool_id }) => tool_id);

    const allowedVectorStoreIds =
      vectorStoreIds ??
      (
        this.database
          .prepare(
            "SELECT vector_store_id FROM automation_agent_vector_stores WHERE agent_id=? ORDER BY vector_store_id",
          )
          .all(row.id) as Array<{ vector_store_id: number }>
      ).map((item) => item.vector_store_id);

    const allowedSkillIds =
      skillIds ??
      (
        this.database
          .prepare(
            "SELECT skill_id FROM automation_agent_skills WHERE agent_id=? ORDER BY skill_id",
          )
          .all(row.id) as Array<{ skill_id: number }>
      ).map((item) => item.skill_id);

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      textModelId: row.text_model_id,
      status: row.status,
      allowedToolIds,
      allowedVectorStoreIds,
      allowedSkillIds,
      memoryRead: Boolean(row.memory_read),
      memoryWrite: Boolean(row.memory_write),
      retrievalLimit: row.retrieval_limit,
      maxToolCalls: row.max_tool_calls,
      timeoutSeconds: row.timeout_seconds,
      terminalPolicy: parseJsonDto(
        agentTerminalPolicyDtoSchema,
        row.terminal_policy_json,
      ),
      directoryPolicy: parseJsonDto(
        agentDirectoryPolicyDtoSchema,
        row.directory_policy_json,
      ),
      runs: row.runs,
      updatedAt: row.updated_at,
    };
  }

}
