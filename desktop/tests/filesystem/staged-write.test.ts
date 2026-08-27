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
  const context = {
    runId: "run-1",
    conversationId: "conversation-1",
    toolCallId: "tool-1",
    policy: undefined,
  };
  return { root, service, context };
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

  it("rejects out-of-order chunks and removes abandoned temporary files", () => {
    const { root, service, context } = fixture();
    const target = join(root, "large.txt");
    const started = service.beginWrite({ path: target }, context);

    expect(() =>
      service.appendWrite(
        { sessionId: started.sessionId, sequence: 1, content: "wrong" },
        context,
      ),
    ).toThrow("Ожидалась часть №0");

    service.forgetRun("run-1");
    expect(existsSync(target)).toBe(false);
    expect(readdirSync(root).some((name) => name.endsWith(".zvs-staged"))).toBe(
      false,
    );
  });
});
