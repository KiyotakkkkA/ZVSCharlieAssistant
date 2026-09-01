import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrations } from "../../src/host/infrastructure/database/migrations";
import { ReportDocxService } from "../../src/host/infrastructure/tools/report-docx.service";

const roots: string[] = [];
const databases: Database.Database[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  for (const database of databases.splice(0)) database.close();
});

function makeDatabase(): Database.Database {
  const database = new Database(":memory:");
  database.pragma("foreign_keys = ON");
  runMigrations(database);
  databases.push(database);
  return database;
}

describe("ReportDocxService staged reports", () => {
  it("assembles ordered block batches and writes DOCX only on commit", async () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-staged-report-"));
    roots.push(root);
    const service = new ReportDocxService(root, makeDatabase());
    const started = service.begin(
      {
        fileName: "architecture-audit",
        template: "mirea-report-gost",
        title: "Аудит",
      },
      "run-1",
    );

    service.addBlocks(
      {
        sessionId: started.sessionId,
        sequence: 0,
        blocks: [{ type: "heading", level: 1, text: "Архитектура" }],
      },
      "run-1",
    );
    const appended = service.addBlocks(
      {
        sessionId: started.sessionId,
        sequence: 1,
        blocks: [{ type: "paragraph", paragraphs: ["Сводка проекта."] }],
      },
      "run-1",
    );
    expect(appended.blocksReceived).toBe(2);
    expect(existsSync(join(root, "architecture-audit.docx"))).toBe(false);

    const report = await service.commit(
      { sessionId: started.sessionId },
      "run-1",
    );
    expect(report.blocks).toBe(2);
    expect(existsSync(report.path)).toBe(true);
    expect(statSync(report.path).size).toBeGreaterThan(0);
  });

  it("does not allow another run to append or commit a report", () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-staged-report-owner-"));
    roots.push(root);
    const service = new ReportDocxService(root, makeDatabase());
    const started = service.begin(
      { fileName: "private", template: "mirea-report-gost" },
      "run-1",
    );

    expect(() =>
      service.addBlocks(
        {
          sessionId: started.sessionId,
          sequence: 0,
          blocks: [{ type: "paragraph", paragraphs: ["content"] }],
        },
        "run-2",
      ),
    ).toThrow("принадлежит другой задаче");
  });

  it("keeps a conversation-owned session between generation runs", () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-staged-report-resume-"));
    roots.push(root);
    const service = new ReportDocxService(root, makeDatabase());
    const started = service.begin(
      { fileName: "resumable", template: "mirea-report-gost" },
      "conversation-1",
    );

    service.abortConversation("run-1");

    expect(
      service.addBlocks(
        {
          sessionId: started.sessionId,
          sequence: 0,
          blocks: [{ type: "paragraph", paragraphs: ["Продолжение"] }],
        },
        "conversation-1",
      ).nextSequence,
    ).toBe(1);
  });

  it("survives the process restarting mid-build (session lives in SQLite, not memory)", () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-staged-report-crash-"));
    roots.push(root);
    const database = makeDatabase();
    const before = new ReportDocxService(root, database);
    const started = before.begin(
      { fileName: "durable", template: "mirea-report-gost" },
      "run-1",
    );
    before.addBlocks(
      {
        sessionId: started.sessionId,
        sequence: 0,
        blocks: [{ type: "heading", level: 1, text: "Раздел 1" }],
      },
      "run-1",
    );

    const after = new ReportDocxService(root, database);
    const appended = after.addBlocks(
      {
        sessionId: started.sessionId,
        sequence: 1,
        blocks: [
          { type: "paragraph", paragraphs: ["Раздел дописан после рестарта."] },
        ],
      },
      "run-1",
    );
    expect(appended.blocksReceived).toBe(2);
  });
});
