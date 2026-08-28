import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  fileSuggestions,
  skillSuggestions,
} from "../../src/cli/tui/autocomplete";

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

    expect(fileSuggestions(root, "@file ")).toEqual([
      expect.objectContaining({ value: "@file src/", kind: "directory" }),
      expect.objectContaining({ value: "@file settings.json", kind: "file" }),
    ]);
    expect(fileSuggestions(root, "@file set")[0]?.value).toBe(
      "@file settings.json",
    );
  });

  it("не позволяет autocomplete выйти выше корня", () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-tui-"));
    roots.push(root);
    expect(fileSuggestions(root, "@file ../")).toEqual([]);
  });

  it("дополняет имена файлов с пробелами", () => {
    const root = mkdtempSync(join(tmpdir(), "zvs-tui-"));
    roots.push(root);
    writeFileSync(join(root, "my report.md"), "text");

    expect(fileSuggestions(root, "@file my rep")[0]?.value).toBe(
      "@file my report.md",
    );
  });

  it("фильтрует навыки только в пространстве @skill", () => {
    const skills = [
      {
        id: "skill-1",
        slug: "code-review",
        name: "Проверка кода",
        description: "Ищет ошибки и регрессии",
      },
    ];
    expect(skillSuggestions(skills, "@skill код")[0]).toMatchObject({
      value: "skill-1",
      kind: "skill",
    });
    expect(skillSuggestions(skills, "@file код")).toEqual([]);
  });
});
