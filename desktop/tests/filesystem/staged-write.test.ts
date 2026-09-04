import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FileEditRepository } from "../../src/host/infrastructure/database/file-edit.repository";
import { FileSystemService } from "../../src/host/infrastructure/filesystem/file-system.service";
import type { PathResolver } from "../../src/host/infrastructure/filesystem/path-resolver";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "zvs-staged-write-"));
  roots.push(root);
  const resolver = {
    resolve: (path: string) => path,
  } as unknown as PathResolver;
  const edits = {
    ensureCheckpoint: vi.fn((input: Record<string, unknown>) => ({
      id: "checkpoint-1",
      ...input,
    })),
    recordEdit: vi.fn((input: Record<string, unknown>) => ({
      id: "edit-1",
      reverted: false,
      createdAt: new Date().toISOString(),
      movedTo: null,
      ...input,
    })),
  } as unknown as FileEditRepository;
  const service = new FileSystemService(
    resolver,
    edits,
    join(root, "checkpoints"),
  );
  const contextFor = (runId: string, conversationId: string) => ({
    runId,
    conversationId,
    toolCallId: "tool-1",
    policy: undefined,
  });
  const context = contextFor("run-1", "conversation-1");
  return { root, service, context, contextFor };
}

describe("FileSystemService staged writes", () => {
  it("keeps the target untouched until ordered chunks are committed", () => {
    const { root, service, context } = fixture();
    const target = join(root, "report.html");
    const started = service.beginWrite({ path: target }, context);

    expect(existsSync(target)).toBe(false);
    expect(
      service.appendWrite(
        { sessionId: started.sessionId, sequence: 0, content: "<h1>Audit" },
        context,
      ).nextSequence,
    ).toBe(1);
    service.appendWrite(
      { sessionId: started.sessionId, sequence: 1, content: "</h1>" },
      context,
    );
    expect(existsSync(target)).toBe(false);

    const edit = service.commitWrite({ sessionId: started.sessionId }, context);
    expect(readFileSync(target, "utf8")).toBe("<h1>Audit</h1>");
    expect(edit.operation).toBe("create");
    expect(readdirSync(root).some((name) => name.endsWith(".zvs-staged"))).toBe(
      false,
    );
  });

  it("rejects out-of-order chunks", () => {
    const { root, service, context } = fixture();
    const target = join(root, "large.txt");
    const started = service.beginWrite({ path: target }, context);

    expect(() =>
      service.appendWrite(
        { sessionId: started.sessionId, sequence: 1, content: "wrong" },
        context,
      ),
    ).toThrow("Ожидалась часть №0");
  });

  it("survives forgetRun and resumes from a new run in the same conversation", () => {
    const { root, service, context, contextFor } = fixture();
    const target = join(root, "resumable.txt");
    const started = service.beginWrite({ path: target }, context);
    service.appendWrite(
      { sessionId: started.sessionId, sequence: 0, content: "first" },
      context,
    );

    service.forgetRun("run-1");
    expect(readdirSync(root).some((name) => name.endsWith(".zvs-staged"))).toBe(
      true,
    );

    const nextRunContext = contextFor("run-2", "conversation-1");
    expect(
      service.appendWrite(
        { sessionId: started.sessionId, sequence: 1, content: "-second" },
        nextRunContext,
      ).nextSequence,
    ).toBe(2);
    const edit = service.commitWrite(
      { sessionId: started.sessionId },
      nextRunContext,
    );
    expect(readFileSync(target, "utf8")).toBe("first-second");
    expect(edit.operation).toBe("create");
  });

  it("rejects a session from a different conversation", () => {
    const { service, context, contextFor, root } = fixture();
    const target = join(root, "private.txt");
    const started = service.beginWrite({ path: target }, context);

    const otherConversation = contextFor("run-2", "conversation-2");
    expect(() =>
      service.appendWrite(
        { sessionId: started.sessionId, sequence: 0, content: "x" },
        otherConversation,
      ),
    ).toThrow("принадлежит другому диалогу");
  });

  it("removes abandoned sessions on forgetConversation", () => {
    const { root, service, context } = fixture();
    const target = join(root, "abandoned.txt");
    const started = service.beginWrite({ path: target }, context);
    service.appendWrite(
      { sessionId: started.sessionId, sequence: 0, content: "partial" },
      context,
    );

    service.forgetConversation("conversation-1");
    expect(existsSync(target)).toBe(false);
    expect(readdirSync(root).some((name) => name.endsWith(".zvs-staged"))).toBe(
      false,
    );
    expect(() =>
      service.commitWrite({ sessionId: started.sessionId }, context),
    ).toThrow("Сессия поэтапной записи не найдена или истекла");
  });
});
