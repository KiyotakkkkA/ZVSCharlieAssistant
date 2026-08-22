import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigurationTransferRepository } from "../../src/host/infrastructure/data-transfer/configuration-transfer.repository";
import { dataTransferPayloadSchema } from "../../src/host/infrastructure/data-transfer/secret-storage-transfer";
import { IntegrationRepository } from "../../src/host/infrastructure/database/integration.repository";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ScenarioGraphRepository } from "../../src/host/infrastructure/database/scenario-graph.repository";
import { resolveDataTransferEntities } from "../../src/shared/dto/data-transfer.dto";

const ids = {
  category: "019cba09-8f30-7000-8000-000000000501",
  secret: "019cba09-8f30-7000-8000-000000000502",
  provider: "019cba09-8f30-7000-8000-000000000503",
  model: "019cba09-8f30-7000-8000-000000000504",
  integration: "019cba09-8f30-7000-8000-000000000505",
  store: "019cba09-8f30-7000-8000-000000000506",
  agent: "019cba09-8f30-7000-8000-000000000507",
  scenario: "019cba09-8f30-7000-8000-000000000508",
  triggerNode: "019cba09-8f30-7000-8000-000000000509",
  agentNode: "019cba09-8f30-7000-8000-00000000050a",
};

const databases: Database.Database[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe("configuration transfer", () => {
  it("resolves the complete type dependency closure", () => {
    expect(resolveDataTransferEntities(["scenarios"])).toEqual([
      "secretCategories",
      "secrets",
      "skills",
      "providers",
      "integrations",
      "vectorStores",
      "agents",
      "scenarios",
    ]);
  });

  it("preserves UUID relations and resets non-portable runtime state", () => {
    const source = createDatabase();
    seedSource(source);
    const sourceTransfer = createTransfer(source);
    const sections = sourceTransfer.exportSections(
      new Set([
        "providers",
        "integrations",
        "vectorStores",
        "agents",
        "scenarios",
      ]),
    );
    const payload = dataTransferPayloadSchema.parse({
      sections: {
        secretStorage: {
          version: 2,
          categories: [{ id: ids.category, label: "Imported" }],
          secrets: [
            {
              id: ids.secret,
              categoryId: ids.category,
              label: "Token",
              content: "secret",
            },
          ],
        },
        ...sections,
      },
    });

    const target = createDatabase();
    target
      .prepare("INSERT INTO secret_categories(id,label) VALUES(?,?)")
      .run(ids.category, "Imported");
    target
      .prepare(
        "INSERT INTO secret_entities(id,category_id,label,content) VALUES(?,?,?,?)",
      )
      .run(ids.secret, ids.category, "Token", "secret");
    const targetTransfer = createTransfer(target);

    expect(targetTransfer.preview(payload).missingDependencies).toEqual([]);
    targetTransfer.import(payload, "overwrite");

    expect(
      target
        .prepare("SELECT api_key_secret_id FROM text_provider_configs WHERE id=?")
        .pluck()
        .get(ids.provider),
    ).toBe(ids.secret);
    expect(
      target
        .prepare("SELECT embedding_model_id,status FROM vector_stores WHERE id=?")
        .get(ids.store),
    ).toEqual({ embedding_model_id: ids.model, status: "disabled" });
    expect(
      target
        .prepare("SELECT text_model_id FROM automation_agents WHERE id=?")
        .pluck()
        .get(ids.agent),
    ).toBe(ids.model);
    expect(
      target
        .prepare(
          "SELECT vector_store_id FROM automation_agent_vector_stores WHERE agent_id=?",
        )
        .pluck()
        .get(ids.agent),
    ).toBe(ids.store);
    expect(
      target
        .prepare("SELECT status,checked_at FROM integration_profiles WHERE id=?")
        .get(ids.integration),
    ).toEqual({ status: "unchecked", checked_at: null });
    expect(
      target
        .prepare(
          "SELECT integration_profile_id FROM scenario_trigger_bindings WHERE scenario_id=? AND kind='telegram'",
        )
        .pluck()
        .get(ids.scenario),
    ).toBe(ids.integration);
    expect(target.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("reports a missing dependency before writing", () => {
    const target = createDatabase();
    const transfer = createTransfer(target);
    const payload = dataTransferPayloadSchema.parse({
      sections: {
        vectorStores: {
          version: 1,
          items: [
            {
              id: ids.store,
              name: "Knowledge",
              description: "",
              embeddingModelId: ids.model,
              searchMode: "vector",
              chunkSizeTokens: 700,
              chunkOverlapTokens: 100,
            },
          ],
        },
      },
    });

    expect(transfer.preview(payload).missingDependencies).toContainEqual({
      ownerKind: "vectorStore",
      ownerId: ids.store,
      dependencyKind: "model",
      dependencyId: ids.model,
    });
    expect(() => transfer.import(payload, "overwrite")).toThrow(
      /Не найдена зависимость/,
    );
  });
});

function createDatabase(): Database.Database {
  const database = new Database(":memory:");
  databases.push(database);
  database.pragma("foreign_keys = ON");
  runMigrations(database);
  return database;
}

function createTransfer(database: Database.Database) {
  return new ConfigurationTransferRepository(
    database,
    new ScenarioGraphRepository(database),
    new IntegrationRepository(database),
  );
}

function seedSource(database: Database.Database): void {
  database
    .prepare("INSERT INTO secret_categories(id,label) VALUES(?,?)")
    .run(ids.category, "Imported");
  database
    .prepare(
      "INSERT INTO secret_entities(id,category_id,label,content) VALUES(?,?,?,?)",
    )
    .run(ids.secret, ids.category, "Token", "secret");
  database
    .prepare(
      `INSERT INTO text_provider_configs
       (id,kind,name,base_url,api_key_secret_id,enabled,checked_at,provider_type)
       VALUES(?,'openrouter','Provider','https://example.test',?,1,'today','text')`,
    )
    .run(ids.provider, ids.secret);
  database
    .prepare(
      `INSERT INTO text_provider_models
       (id,provider_id,remote_id,name,enabled) VALUES(?,?,?,'Model',1)`,
    )
    .run(ids.model, ids.provider, "model-1");
  database
    .prepare(
      `INSERT INTO integration_profiles
       (id,kind,name,enabled,config_json,status,checked_at,connection_metadata_json)
       VALUES(?,'telegram_bot','Telegram',1,'{}','connected','today','{"identity":"runtime"}')`,
    )
    .run(ids.integration);
  database
    .prepare(
      "INSERT INTO integration_secret_bindings(profile_id,binding_key,secret_id) VALUES(?,'botToken',?)",
    )
    .run(ids.integration, ids.secret);
  database
    .prepare(
      `INSERT INTO vector_stores
       (id,name,embedding_model_id,status,search_mode) VALUES(?,'Knowledge',?,'ready','vector')`,
    )
    .run(ids.store, ids.model);
  database
    .prepare(
      `INSERT INTO automation_agents
       (id,name,instructions,text_model_id,status) VALUES(?,'Agent','Instructions',?,'active')`,
    )
    .run(ids.agent, ids.model);
  database
    .prepare(
      "INSERT INTO automation_agent_vector_stores(agent_id,vector_store_id) VALUES(?,?)",
    )
    .run(ids.agent, ids.store);

  new ScenarioGraphRepository(database).upsert({
    id: ids.scenario,
    name: "Scenario",
    status: "active",
    graph: {
      version: 2,
      nodes: [
        {
          id: ids.triggerNode,
          kind: "trigger.telegram",
          name: "Trigger",
          description: "",
          x: 0,
          y: 0,
          config: { integrationProfileId: ids.integration },
          runtime: {},
          disabled: false,
          notes: "",
          groupId: null,
        },
        {
          id: ids.agentNode,
          kind: "agent",
          name: "Agent",
          description: "",
          x: 100,
          y: 0,
          config: { agentId: ids.agent, modelId: ids.model },
          runtime: {},
          disabled: false,
          notes: "",
          groupId: null,
        },
      ],
      edges: [],
      groups: [],
      variables: [],
      maxNodeExecutions: 1_000,
    },
  });
}
