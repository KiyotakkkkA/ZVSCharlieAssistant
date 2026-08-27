import type Database from "better-sqlite3";
import type { DataTransferEntity } from "../../../shared/dto";
import type {
  DataTransferConflict,
  DataTransferCounts,
  ImportResult,
} from "../../../shared/models/data-transfer";
import type { IntegrationRepository } from "../database/integration.repository";
import type { ScenarioGraphRepository } from "../database/scenario-graph.repository";
import type {
  DataTransferPayload,
  PortableAgent,
  PortableIntegration,
  PortableProvider,
  PortableScenario,
  PortableVectorStore,
} from "./secret-storage-transfer";

type ConfigEntity = Extract<
  DataTransferEntity,
  "providers" | "integrations" | "vectorStores" | "agents" | "scenarios"
>;
type CountsByEntity = Partial<Record<DataTransferEntity, DataTransferCounts>>;
type ImportCountsByEntity = ImportResult["entities"];

export interface MissingDependency {
  ownerKind: string;
  ownerId: string;
  dependencyKind: string;
  dependencyId: string;
}

const CONFIG_ENTITIES: ConfigEntity[] = [
  "providers",
  "integrations",
  "vectorStores",
  "agents",
  "scenarios",
];

export class ConfigurationTransferRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly scenarios: ScenarioGraphRepository,
    private readonly integrations: IntegrationRepository,
  ) {}

  transaction<T>(operation: () => T): T {
    return this.db.transaction(operation)();
  }

  exportSections(
    entities: ReadonlySet<DataTransferEntity>,
  ): Pick<
    DataTransferPayload["sections"],
    "providers" | "integrations" | "vectorStores" | "agents" | "scenarios"
  > {
    return {
      ...(entities.has("providers")
        ? { providers: { version: 1 as const, items: this.providers() } }
        : {}),
      ...(entities.has("integrations")
        ? {
            integrations: {
              version: 1 as const,
              items: this.integrationProfiles(),
            },
          }
        : {}),
      ...(entities.has("vectorStores")
        ? { vectorStores: { version: 1 as const, items: this.vectorStores() } }
        : {}),
      ...(entities.has("agents")
        ? {
            agents: {
              version: 1 as const,
              items: this.agents(),
              toolSecretBindings: this.toolSecretBindings(),
            },
          }
        : {}),
      ...(entities.has("scenarios")
        ? {
            scenarios: {
              version: 1 as const,
              items: this.scenarioDefinitions(),
            },
          }
        : {}),
    };
  }

  preview(payload: DataTransferPayload): {
    entities: CountsByEntity;
    conflicts: DataTransferConflict[];
    missingDependencies: MissingDependency[];
  } {
    const entities: CountsByEntity = {};
    const conflicts: DataTransferConflict[] = [];
    for (const kind of CONFIG_ENTITIES) {
      const items = payload.sections[kind]?.items;
      if (!items) continue;
      const counts = { create: 0, update: 0, conflict: 0 };
      for (const item of items) {
        if (this.exists(tableFor(kind), item.id)) counts.update++;
        else counts.create++;
      }
      entities[kind] = counts;
    }

    const modelIds = new Set<string>();
    for (const provider of payload.sections.providers?.items ?? []) {
      for (const model of provider.models) {
        modelIds.add(model.id);
        const collision = this.db
          .prepare(
            "SELECT id FROM text_provider_models WHERE provider_id=? AND remote_id=? AND id<>?",
          )
          .get(provider.id, model.remoteId, model.id) as
          { id: string } | undefined;
        if (collision)
          conflicts.push({
            kind: "providers",
            label: model.name,
            reason: "Модель с таким remote ID уже имеет другой UUID",
          });
      }
    }

    return {
      entities,
      conflicts,
      missingDependencies: this.findMissingDependencies(payload, modelIds),
    };
  }

  import(
    payload: DataTransferPayload,
    policy: "skip" | "overwrite",
  ): { entities: ImportCountsByEntity; skipped: number } {
    const preview = this.preview(payload);
    const firstConflict = preview.conflicts.at(0);
    if (firstConflict)
      throw new Error(
        `Импорт содержит несовместимые идентификаторы: ${firstConflict.reason}`,
      );
    const missing = preview.missingDependencies.at(0);
    if (missing) {
      throw new Error(
        `Не найдена зависимость ${missing.dependencyKind} #${missing.dependencyId} для ${missing.ownerKind} #${missing.ownerId}`,
      );
    }

    const entities: ImportCountsByEntity = {};
    let skipped = 0;
    this.db.transaction(() => {
      const providers = this.importProviders(payload, policy);
      entities.providers = providers.counts;
      skipped += providers.skipped;
      const integrationProfiles = this.importIntegrations(payload, policy);
      entities.integrations = integrationProfiles.counts;
      skipped += integrationProfiles.skipped;
      const vectorStores = this.importVectorStores(payload, policy);
      entities.vectorStores = vectorStores.counts;
      skipped += vectorStores.skipped;
      const agents = this.importAgents(payload, policy);
      entities.agents = agents.counts;
      skipped += agents.skipped;
      const scenarios = this.importScenarios(payload, policy);
      entities.scenarios = scenarios.counts;
      skipped += scenarios.skipped;
    })();
    return { entities, skipped };
  }

  private providers(): PortableProvider[] {
    const providers = this.db
      .prepare("SELECT * FROM text_provider_configs ORDER BY name,id")
      .all() as Array<Record<string, unknown>>;
    const models = this.db
      .prepare(
        "SELECT * FROM text_provider_models ORDER BY provider_id,name,id",
      )
      .all() as Array<Record<string, unknown>>;
    return providers.map((row) => ({
      id: String(row.id),
      kind: row.kind as PortableProvider["kind"],
      providerType: row.provider_type as PortableProvider["providerType"],
      name: String(row.name),
      baseUrl: String(row.base_url),
      apiKeySecretId: nullableString(row.api_key_secret_id),
      enabled: Boolean(row.enabled),
      generationSettings: JSON.parse(String(row.generation_settings_json)),
      models: models
        .filter((model) => model.provider_id === row.id)
        .map((model) => ({
          id: String(model.id),
          remoteId: String(model.remote_id),
          name: String(model.name),
          modifiedAt: String(model.modified_at),
          size: Number(model.size),
          digest: String(model.digest),
          details: normalizeModelDetails(String(model.details_json)),
          enabled: Boolean(model.enabled),
        })),
    }));
  }

  private integrationProfiles(): PortableIntegration[] {
    return this.integrations.snapshot().profiles.map((profile) => ({
      id: profile.id,
      kind: profile.kind,
      name: profile.name,
      enabled: profile.enabled,
      config: profile.config,
      secretBindings: profile.secretBindings,
    }));
  }

  private vectorStores(): PortableVectorStore[] {
    return (
      this.db
        .prepare("SELECT * FROM vector_stores ORDER BY name,id")
        .all() as Array<Record<string, unknown>>
    ).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description),
      embeddingModelId: nullableString(row.embedding_model_id),
      searchMode: row.search_mode as PortableVectorStore["searchMode"],
      chunkSizeTokens: Number(row.chunk_size_tokens),
      chunkOverlapTokens: Number(row.chunk_overlap_tokens),
    }));
  }

  private agents(): PortableAgent[] {
    const rows = this.db
      .prepare("SELECT * FROM automation_agents ORDER BY name,id")
      .all() as Array<Record<string, unknown>>;
    const relations = (table: string, valueColumn: string) =>
      this.db
        .prepare(`SELECT agent_id,${valueColumn} value FROM ${table}`)
        .all() as Array<{
        agent_id: string;
        value: string;
      }>;
    const tools = relations("automation_agent_tools", "tool_id");
    const stores = relations(
      "automation_agent_vector_stores",
      "vector_store_id",
    );
    const skills = relations("automation_agent_skills", "skill_id");
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      description: String(row.description),
      instructions: String(row.instructions),
      textModelId: nullableString(row.text_model_id),
      status: row.status as PortableAgent["status"],
      allowedToolIds: relationValues(tools, String(row.id)),
      allowedVectorStoreIds: relationValues(stores, String(row.id)),
      allowedSkillIds: relationValues(skills, String(row.id)),
      memoryRead: Boolean(row.memory_read),
      memoryWrite: Boolean(row.memory_write),
      retrievalLimit: Number(row.retrieval_limit),
      maxToolCalls: Number(row.max_tool_calls),
      timeoutSeconds: Number(row.timeout_seconds),
      terminalPolicy: JSON.parse(String(row.terminal_policy_json)),
      directoryPolicy: JSON.parse(String(row.directory_policy_json)),
    }));
  }

  private toolSecretBindings() {
    return (
      this.db
        .prepare(
          "SELECT tool_id,binding_key,secret_id FROM automation_tool_secret_bindings ORDER BY tool_id,binding_key",
        )
        .all() as Array<{
        tool_id: string;
        binding_key: string;
        secret_id: string;
      }>
    ).map((row) => ({
      toolId: row.tool_id,
      key: row.binding_key,
      secretId: row.secret_id,
    }));
  }

  private scenarioDefinitions(): PortableScenario[] {
    return this.scenarios.list().map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      description: scenario.description,
      status: scenario.status,
      graph: scenario.graph,
      toolSettings: scenario.toolSettings,
    }));
  }

  private importProviders(
    payload: DataTransferPayload,
    policy: "skip" | "overwrite",
  ) {
    const counts = emptyImportCounts();
    let skipped = 0;
    for (const provider of payload.sections.providers?.items ?? []) {
      const exists = this.exists("text_provider_configs", provider.id);
      if (exists && policy === "skip") {
        const insertMissingModel = this.db.prepare(
          `INSERT INTO text_provider_models
           (id,provider_id,remote_id,name,modified_at,size,digest,details_json,enabled)
           VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
        );
        for (const model of provider.models)
          insertMissingModel.run(
            model.id,
            provider.id,
            model.remoteId,
            model.name,
            model.modifiedAt,
            model.size,
            model.digest,
            JSON.stringify(model.details),
            Number(model.enabled),
          );
        skipped++;
        continue;
      }
      this.db
        .prepare(
          `INSERT INTO text_provider_configs
           (id,kind,provider_type,name,base_url,api_key_secret_id,enabled,checked_at,generation_settings_json)
           VALUES(?,?,?,?,?,?,?,'',?)
           ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,provider_type=excluded.provider_type,
             name=excluded.name,base_url=excluded.base_url,api_key_secret_id=excluded.api_key_secret_id,
             enabled=excluded.enabled,checked_at='',limits_json=NULL,
             generation_settings_json=excluded.generation_settings_json,updated_at=CURRENT_TIMESTAMP`,
        )
        .run(
          provider.id,
          provider.kind,
          provider.providerType,
          provider.name,
          provider.baseUrl,
          provider.apiKeySecretId,
          Number(provider.enabled),
          JSON.stringify(provider.generationSettings),
        );
      for (const model of provider.models)
        this.db
          .prepare(
            `INSERT INTO text_provider_models
             (id,provider_id,remote_id,name,modified_at,size,digest,details_json,enabled)
             VALUES(?,?,?,?,?,?,?,?,?)
             ON CONFLICT(id) DO UPDATE SET provider_id=excluded.provider_id,remote_id=excluded.remote_id,
               name=excluded.name,modified_at=excluded.modified_at,size=excluded.size,digest=excluded.digest,
               details_json=excluded.details_json,enabled=excluded.enabled`,
          )
          .run(
            model.id,
            provider.id,
            model.remoteId,
            model.name,
            model.modifiedAt,
            model.size,
            model.digest,
            JSON.stringify(model.details),
            Number(model.enabled),
          );
      counts[exists ? "update" : "create"]++;
    }
    return { counts, skipped };
  }

  private importIntegrations(
    payload: DataTransferPayload,
    policy: "skip" | "overwrite",
  ) {
    const counts = emptyImportCounts();
    let skipped = 0;
    for (const profile of payload.sections.integrations?.items ?? []) {
      const exists = this.exists("integration_profiles", profile.id);
      if (exists && policy === "skip") {
        skipped++;
        continue;
      }
      this.db
        .prepare(
          `INSERT INTO integration_profiles(id,kind,name,enabled,config_json,status)
           VALUES(?,?,?,?,?,'unchecked')
           ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,name=excluded.name,enabled=excluded.enabled,
             config_json=excluded.config_json,status='unchecked',checked_at=NULL,last_error=NULL,
             connection_metadata_json='{}',updated_at=CURRENT_TIMESTAMP`,
        )
        .run(
          profile.id,
          profile.kind,
          profile.name,
          Number(profile.enabled),
          JSON.stringify(profile.config),
        );
      this.db
        .prepare("DELETE FROM integration_secret_bindings WHERE profile_id=?")
        .run(profile.id);
      const insert = this.db.prepare(
        "INSERT INTO integration_secret_bindings(profile_id,binding_key,secret_id) VALUES(?,?,?)",
      );
      for (const [key, secretId] of Object.entries(profile.secretBindings))
        insert.run(profile.id, key, secretId);
      counts[exists ? "update" : "create"]++;
    }
    return { counts, skipped };
  }

  private importVectorStores(
    payload: DataTransferPayload,
    policy: "skip" | "overwrite",
  ) {
    const counts = emptyImportCounts();
    let skipped = 0;
    for (const store of payload.sections.vectorStores?.items ?? []) {
      const exists = this.exists("vector_stores", store.id);
      if (exists && policy === "skip") {
        skipped++;
        continue;
      }
      this.db
        .prepare(
          `INSERT INTO vector_stores
           (id,name,description,embedding_model_id,status,search_mode,chunk_size_tokens,chunk_overlap_tokens)
           VALUES(?,?,?,?,'disabled',?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,
             embedding_model_id=excluded.embedding_model_id,status='disabled',search_mode=excluded.search_mode,
             chunk_size_tokens=excluded.chunk_size_tokens,chunk_overlap_tokens=excluded.chunk_overlap_tokens,
             vector_dimension=NULL,updated_at=CURRENT_TIMESTAMP`,
        )
        .run(
          store.id,
          store.name,
          store.description,
          store.embeddingModelId,
          store.searchMode,
          store.chunkSizeTokens,
          store.chunkOverlapTokens,
        );
      counts[exists ? "update" : "create"]++;
    }
    return { counts, skipped };
  }

  private importAgents(
    payload: DataTransferPayload,
    policy: "skip" | "overwrite",
  ) {
    const counts = emptyImportCounts();
    let skipped = 0;
    for (const agent of payload.sections.agents?.items ?? []) {
      const exists = this.exists("automation_agents", agent.id);
      if (exists && policy === "skip") {
        skipped++;
        continue;
      }
      this.db
        .prepare(
          `INSERT INTO automation_agents
           (id,name,description,instructions,text_model_id,status,max_tool_calls,timeout_seconds,
            retrieval_limit,terminal_policy_json,directory_policy_json,memory_read,memory_write)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,
             instructions=excluded.instructions,text_model_id=excluded.text_model_id,status=excluded.status,
             max_tool_calls=excluded.max_tool_calls,timeout_seconds=excluded.timeout_seconds,
             retrieval_limit=excluded.retrieval_limit,terminal_policy_json=excluded.terminal_policy_json,
             directory_policy_json=excluded.directory_policy_json,memory_read=excluded.memory_read,
             memory_write=excluded.memory_write,updated_at=CURRENT_TIMESTAMP`,
        )
        .run(
          agent.id,
          agent.name,
          agent.description,
          agent.instructions,
          agent.textModelId,
          agent.status,
          agent.maxToolCalls,
          agent.timeoutSeconds,
          agent.retrievalLimit,
          JSON.stringify(agent.terminalPolicy),
          JSON.stringify(agent.directoryPolicy),
          Number(agent.memoryRead),
          Number(agent.memoryWrite),
        );
      this.replaceAgentRelations(agent);
      counts[exists ? "update" : "create"]++;
    }
    if (payload.sections.agents) {
      const insert = this.db.prepare(
        `INSERT INTO automation_tool_secret_bindings(tool_id,binding_key,secret_id) VALUES(?,?,?)
         ON CONFLICT(tool_id,binding_key) DO ${
           policy === "overwrite"
             ? "UPDATE SET secret_id=excluded.secret_id"
             : "NOTHING"
         }`,
      );
      for (const binding of payload.sections.agents.toolSecretBindings)
        insert.run(binding.toolId, binding.key, binding.secretId);
    }
    return { counts, skipped };
  }

  private replaceAgentRelations(agent: PortableAgent): void {
    const replace = (table: string, column: string, values: string[]) => {
      this.db.prepare(`DELETE FROM ${table} WHERE agent_id=?`).run(agent.id);
      const insert = this.db.prepare(
        `INSERT INTO ${table}(agent_id,${column}) VALUES(?,?)`,
      );
      for (const value of [...new Set(values)]) insert.run(agent.id, value);
    };
    replace("automation_agent_tools", "tool_id", agent.allowedToolIds);
    replace(
      "automation_agent_vector_stores",
      "vector_store_id",
      agent.allowedVectorStoreIds,
    );
    replace("automation_agent_skills", "skill_id", agent.allowedSkillIds);
  }

  private importScenarios(
    payload: DataTransferPayload,
    policy: "skip" | "overwrite",
  ) {
    const counts = emptyImportCounts();
    let skipped = 0;
    for (const scenario of payload.sections.scenarios?.items ?? []) {
      const exists = this.exists("automation_scenarios", scenario.id);
      if (exists && policy === "skip") {
        skipped++;
        continue;
      }
      const imported = this.scenarios.upsert(scenario);
      this.integrations.syncTriggerNodeBindings(
        imported.id,
        imported.revisionId,
        imported.graph.nodes,
      );
      counts[exists ? "update" : "create"]++;
    }
    return { counts, skipped };
  }

  private findMissingDependencies(
    payload: DataTransferPayload,
    packageModelIds: Set<string>,
  ): MissingDependency[] {
    const missing: MissingDependency[] = [];
    const packageIds = {
      secret: new Set(
        payload.sections.secretStorage?.secrets.map((item) => item.id) ?? [],
      ),
      model: packageModelIds,
      integration: new Set(
        payload.sections.integrations?.items.map((item) => item.id) ?? [],
      ),
      vectorStore: new Set(
        payload.sections.vectorStores?.items.map((item) => item.id) ?? [],
      ),
      skill: new Set(
        payload.sections.skills?.items.map((item) => item.id) ?? [],
      ),
      agent: new Set(
        payload.sections.agents?.items.map((item) => item.id) ?? [],
      ),
      scenario: new Set(
        payload.sections.scenarios?.items.map((item) => item.id) ?? [],
      ),
    };
    const require = (
      ownerKind: string,
      ownerId: string,
      dependencyKind: keyof typeof packageIds,
      dependencyId: unknown,
    ) => {
      if (typeof dependencyId !== "string" || !dependencyId) return;
      if (packageIds[dependencyKind].has(dependencyId)) return;
      if (this.exists(tableForDependency(dependencyKind), dependencyId)) return;
      missing.push({ ownerKind, ownerId, dependencyKind, dependencyId });
    };
    for (const provider of payload.sections.providers?.items ?? [])
      require("provider", provider.id, "secret", provider.apiKeySecretId);
    for (const profile of payload.sections.integrations?.items ?? [])
      for (const secretId of Object.values(profile.secretBindings))
        require("integration", profile.id, "secret", secretId);
    for (const store of payload.sections.vectorStores?.items ?? [])
      require("vectorStore", store.id, "model", store.embeddingModelId);
    for (const agent of payload.sections.agents?.items ?? []) {
      require("agent", agent.id, "model", agent.textModelId);
      for (const id of agent.allowedVectorStoreIds)
        require("agent", agent.id, "vectorStore", id);
      for (const id of agent.allowedSkillIds)
        require("agent", agent.id, "skill", id);
    }
    for (const binding of payload.sections.agents?.toolSecretBindings ?? [])
      require("tool", binding.toolId, "secret", binding.secretId);
    for (const scenario of payload.sections.scenarios?.items ?? []) {
      const visit = (kind: DependencyKind, id: string) =>
        require("scenario", scenario.id, kind, id);
      scanReferences(scenario.graph, visit);
      scanReferences(scenario.toolSettings, visit);
    }
    return deduplicateMissing(missing);
  }

  private exists(table: string, id: string): boolean {
    return Boolean(
      this.db.prepare(`SELECT 1 FROM ${table} WHERE id=?`).get(id),
    );
  }
}

function tableFor(entity: ConfigEntity): string {
  return {
    providers: "text_provider_configs",
    integrations: "integration_profiles",
    vectorStores: "vector_stores",
    agents: "automation_agents",
    scenarios: "automation_scenarios",
  }[entity];
}

function tableForDependency(kind: string): string {
  return {
    secret: "secret_entities",
    model: "text_provider_models",
    integration: "integration_profiles",
    vectorStore: "vector_stores",
    skill: "automation_skills",
    agent: "automation_agents",
    scenario: "automation_scenarios",
  }[kind]!;
}

function emptyImportCounts() {
  return { create: 0, update: 0 };
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function normalizeModelDetails(
  source: string,
): PortableProvider["models"][number]["details"] {
  const parsed = JSON.parse(source) as Record<string, unknown>;
  return {
    parentModel: "",
    format: "",
    family: "",
    families: null,
    parameterSize: "",
    quantizationLevel: "",
    ...parsed,
  } as PortableProvider["models"][number]["details"];
}

function relationValues(
  rows: Array<{ agent_id: string; value: string }>,
  agentId: string,
): string[] {
  return rows.filter((row) => row.agent_id === agentId).map((row) => row.value);
}

const REFERENCE_KEYS = {
  agentId: "agent",
  modelId: "model",
  vectorStoreId: "vectorStore",
  integrationProfileId: "integration",
  authSecretId: "secret",
  secretId: "secret",
  scenarioId: "scenario",
} as const;

type DependencyKind = (typeof REFERENCE_KEYS)[keyof typeof REFERENCE_KEYS];

function scanReferences(
  value: unknown,
  visit: (kind: DependencyKind, id: string) => void,
): void {
  if (Array.isArray(value)) {
    for (const item of value) scanReferences(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const kind = REFERENCE_KEYS[key as keyof typeof REFERENCE_KEYS];
    if (kind && typeof child === "string" && child) visit(kind, child);
    scanReferences(child, visit);
  }
}

function deduplicateMissing(items: MissingDependency[]): MissingDependency[] {
  return [
    ...new Map(
      items.map((item) => [
        `${item.ownerKind}:${item.ownerId}:${item.dependencyKind}:${item.dependencyId}`,
        item,
      ]),
    ).values(),
  ];
}
