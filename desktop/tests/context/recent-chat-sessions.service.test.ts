import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { RecentChatSessionsService } from "../../src/host/application/services/recent-chat-sessions.service";
import { ChatRepository } from "../../src/host/infrastructure/database/chat.repository";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ProjectRepository } from "../../src/host/infrastructure/database/project.repository";
import { newEntityId } from "../../src/host/infrastructure/database/entity-id";

let database: Database.Database | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe("последние сессии чата", () => {
  it("возвращает не более пяти диалогов вместе с режимом и проектом", () => {
    database = new Database(":memory:");
    database.pragma("foreign_keys = ON");
    runMigrations(database);
    const chats = new ChatRepository(database);
    const projects = new ProjectRepository(database);
    const project = projects.upsert({
      name: "Проект",
      rootPath: null,
      instructions: "",
      defaultAgentId: null,
      defaultModelId: null,
      compactThreshold: 0.78,
      archived: false,
      grants: [],
    });

    const modelIds = Array.from({ length: 6 }, () => newEntityId());
    const ids = Array.from({ length: 6 }, (_, index) => {
      const id = chats.createConversation({
        mode: "planner",
        modelId: modelIds[index],
        permissionMode: "plan",
      });
      database!
        .prepare(
          "UPDATE chat_conversations SET title=?,updated_at=? WHERE id=?",
        )
        .run(`Сессия ${index}`, `2026-08-2${index + 1} 12:00:00`, id);
      return id;
    });
    projects.assignConversation(ids[5]!, project.id);

    const sessions = new RecentChatSessionsService(chats, projects).list();

    expect(sessions).toHaveLength(5);
    expect(sessions[0]).toMatchObject({
      conversationId: ids[5],
      title: "Сессия 5",
      usage: {
        mode: "planner",
        modelId: modelIds[5],
        permissionMode: "plan",
      },
      project: { id: project.id, name: "Проект" },
    });
    expect(sessions.some((session) => session.conversationId === ids[0])).toBe(
      false,
    );
  });
});
