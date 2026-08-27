import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanVectorDirectory } from "../../src/ipc/main/vector-directory";

describe("scanVectorDirectory", () => {
  const roots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
    );
  });

  it("finds supported documents recursively and reports ignored files", async () => {
    const root = await mkdtemp(join(tmpdir(), "zvs-vector-directory-"));
    roots.push(root);
    await mkdir(join(root, "nested"));
    await writeFile(join(root, "document.pdf"), "pdf");
    await writeFile(join(root, "notes.md"), "markdown");
    await writeFile(join(root, "empty.txt"), "");
    await writeFile(join(root, "nested", "manual.TXT"), "text");

    const result = await scanVectorDirectory(root);

    expect(result.preview.supportedFiles).toBe(2);
    expect(result.preview.ignoredFiles).toBe(2);
    expect(result.preview.examples).toEqual([
      "document.pdf",
      "nested/manual.TXT",
    ]);
    expect(result.files.map((file) => file.relativePath)).toEqual(
      result.preview.examples,
    );
  });
});
