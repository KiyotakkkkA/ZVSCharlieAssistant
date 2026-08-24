import { describe, expect, it } from "vitest";
import { CLI_OPTIONS_HELP, CLI_USAGE, HELP_TEXT } from "../../src/cli/args";
import { box, progressBar, wordmark, ZVS_LOGO } from "../../src/cli/ui";
import { truncateVisible, visibleLength } from "../../src/cli/theme";

describe("оболочка CLI", () => {
  it("рисует полноразмерный логотип ZVS", () => {
    expect(wordmark()).toHaveLength(6);
    expect(ZVS_LOGO.join("\n")).toContain("███████╗");
  });

  it("сохраняет одинаковую ширину строк панели", () => {
    const lines = box(["короткая строка", "другая строка"], "ZVS").split(
      "\n",
    );
    expect(new Set(lines.map(visibleLength)).size).toBe(1);
  });

  it("безопасно обрезает цветной текст по видимой ширине", () => {
    const value = "\u001B[32mочень длинная строка\u001B[39m";
    const result = truncateVisible(value, 10);
    expect(visibleLength(result)).toBe(10);
    expect(result).toContain("…");
  });

  it("ограничивает индикатор контекста диапазоном процентов", () => {
    expect(progressBar(-10, 10)).toContain("0%");
    expect(progressBar(140, 10)).toContain("100%");
  });

  it("поддерживает синхронную plain-text справку", () => {
    expect(CLI_USAGE.length).toBeGreaterThan(5);
    expect(CLI_OPTIONS_HELP.length).toBeGreaterThan(3);
    expect(HELP_TEXT).toContain("zvs -p");
    expect(HELP_TEXT).not.toContain("\u001B[");
  });
});
