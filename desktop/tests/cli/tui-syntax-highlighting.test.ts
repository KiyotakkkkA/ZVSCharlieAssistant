import { describe, expect, it } from "vitest";
import {
  highlightCode,
  normalizeCodeLanguage,
} from "../../src/cli/tui/syntax-highlighting";
import { segmentRichContent } from "../../src/cli/tui/molecules/RichContent";

describe("TUI syntax highlighting", () => {
  it("normalizes common fenced-code language aliases", () => {
    expect(normalizeCodeLanguage("tsx")).toBe("typescript");
    expect(normalizeCodeLanguage("ps1")).toBe("powershell");
    expect(normalizeCodeLanguage("sh")).toBe("bash");
  });

  it("uses Highlight.js tokens for TypeScript and preserves multiline code", () => {
    const result = highlightCode(
      "const value: Model = createModel(42);\n// ready",
      "ts",
    );
    const tokens = result.lines.flat();

    expect(result.language).toBe("typescript");
    expect(result.lines).toHaveLength(2);
    expect(tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "const", kind: "keyword" }),
        expect.objectContaining({ text: "42", kind: "number" }),
        expect.objectContaining({ text: "// ready", kind: "comment" }),
      ]),
    );
  });

  it("falls back to unmodified text for an unknown explicit language", () => {
    expect(highlightCode("alpha <=> beta", "zvs-custom")).toEqual({
      language: "zvs-custom",
      lines: [[{ text: "alpha <=> beta", kind: "plain" }]],
    });
  });

  it("keeps every line of a bare fence auto-detection can't classify", () => {
    const code =
      "Готово! Я обновил файл конфигурации и перезапустил сервис.\nВторая строка обычного текста.";
    const result = highlightCode(code);
    expect(result.lines).toEqual([
      [
        {
          text: "Готово! Я обновил файл конфигурации и перезапустил сервис.",
          kind: "plain",
        },
      ],
      [{ text: "Вторая строка обычного текста.", kind: "plain" }],
    ]);
  });

  it("separates Markdown and keeps the fenced-block language", () => {
    const content = "Before\n```typescript\nconst value = 1;\n```\nAfter";
    expect(segmentRichContent(content)).toEqual([
      { kind: "line", text: "Before" },
      {
        kind: "code",
        language: "typescript",
        lines: ["const value = 1;"],
      },
      { kind: "line", text: "After" },
    ]);
  });

  it("renders an unclosed fence as code through the end of the message", () => {
    expect(segmentRichContent("```py\nprint('ok')")).toEqual([
      { kind: "code", language: "py", lines: ["print('ok')"] },
    ]);
  });
});
