import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ScenarioAgentConversationRepository } from "../../src/host/infrastructure/database/scenario-agent-conversation.repository";
import { DurableAgentContext } from "../../src/host/infrastructure/automation/engine/durable-agent-context";

let database: Database.Database | undefined;

function setupDatabase(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  db.prepare(`INSERT INTO automation_scenarios(id,name) VALUES(?,?)`).run(
    "scenario-1",
    "Тестовый сценарий",
  );
  db.prepare(
    `INSERT INTO automation_scenario_revisions(id,scenario_id,version,graph_json)
     VALUES(?,?,?,?)`,
  ).run("revision-1", "scenario-1", 1, "{}");
  db.prepare(
    `INSERT INTO execution_runs(id,kind,origin,scenario_id,scenario_revision_id,status,input_json)
     VALUES(?,?,?,?,?,?,?)`,
  ).run(
    "exec-1",
    "scenario",
    "background",
    "scenario-1",
    "revision-1",
    "running",
    "{}",
  );
  return db;
}

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("долговременный контекст агента", () => {
  it("сохраняет историю после провала и продолжает с неё", () => {
    database = setupDatabase();
    const repo = new ScenarioAgentConversationRepository(database);

    const first = DurableAgentContext.loadOrCreate(
      repo,
      "exec-1",
      "node-1",
      "model-a",
    );
    expect(first.isResumed).toBe(false);
    first.appendUser([{ type: "text", text: "задача" }]);
    first.appendAssistant([{ type: "text", text: "промежуточный ответ" }]);
    first.switchModel("model-b");
    first.markFailed();

    const status = database
      .prepare(`SELECT status FROM scenario_agent_conversations WHERE id=?`)
      .get(first.conversationId) as { status: string } | undefined;
    expect(status?.status).toBe("failed");

    const second = DurableAgentContext.loadOrCreate(
      repo,
      "exec-1",
      "node-1",
      "model-a",
    );
    expect(second.isResumed).toBe(true);
    expect(second.conversationId).toBe(first.conversationId);
    expect(second.activeModelId).toBe("model-b");
    expect(second.compactor.currentMessages.map((m) => m.text)).toEqual([
      "задача",
      "промежуточный ответ",
    ]);
  });
});
