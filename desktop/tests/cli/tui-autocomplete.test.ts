import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fileSuggestions } from "../../src/cli/tui/autocomplete";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("TUI autocomplete", () => {
  it("предлагает директории и файлы относительно корня проекта", () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-tui-"));
    roots.push(root);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "settings.json"), "{}");

    expect(fileSuggestions(root, "@")).toEqual([
      expect.objectContaining({ value: "@src/", kind: "directory" }),
      expect.objectContaining({ value: "@settings.json", kind: "file" }),
    ]);
    expect(fileSuggestions(root, "@set")[0]?.value).toBe("@settings.json");
  });

  it("не позволяет autocomplete выйти выше корня", () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-tui-"));
    roots.push(root);
    expect(fileSuggestions(root, "@../")).toEqual([]);
  });
});
