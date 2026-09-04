import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addCliAttachment } from "../../src/cli/tui/attachments";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("вложения CLI", () => {
  it("читает поддерживаемый файл относительно проекта", async () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-cli-attachment-"));
    roots.push(root);
    mkdirSync(join(root, "Документы"));
    writeFileSync(join(root, "Документы", "отчёт с пробелом.md"), "текст");

    const attachments = await addCliAttachment(
      [],
      root,
      "@file Документы/отчёт с пробелом.md",
    );

    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      fileName: "отчёт с пробелом.md",
      mimeType: "text/plain",
      size: Buffer.byteLength("текст"),
    });
    expect(Buffer.from(attachments[0]!.dataBase64, "base64").toString()).toBe(
      "текст",
    );
  });

  it("не прикрепляет неподдерживаемый файл и путь вне проекта", async () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-cli-attachment-"));
    roots.push(root);
    writeFileSync(join(root, "archive.zip"), "data");

    await expect(
      addCliAttachment([], root, "@file archive.zip"),
    ).rejects.toThrow("не поддерживается");
    await expect(
      addCliAttachment([], root, "@file ../missing.txt"),
    ).rejects.toThrow();
  });
});
