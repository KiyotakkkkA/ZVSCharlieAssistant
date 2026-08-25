import { describe, expect, it } from "vitest";
import { CLI_OPTIONS_HELP, CLI_USAGE, HELP_TEXT } from "../../src/cli/args";
import { compactValue } from "../../src/cli/tui/output";

describe("вывод CLI", () => {
  it("компактно и безопасно отображает значения инструментов", () => {
    expect(compactValue({ path: "src/index.ts" }, 80)).toContain("src/index.ts");
    expect(compactValue("очень длинная строка", 10)).toHaveLength(10);
    expect(compactValue("очень длинная строка", 10).endsWith("…")).toBe(true);
  });

  it("сохраняет синхронную plain-text справку", () => {
    expect(CLI_USAGE.length).toBeGreaterThan(5);
    expect(CLI_OPTIONS_HELP.length).toBeGreaterThan(3);
    expect(HELP_TEXT).toContain("zvs -p");
    expect(HELP_TEXT).not.toContain("\u001B[");
  });
});
