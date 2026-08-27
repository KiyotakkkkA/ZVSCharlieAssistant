import { describe, expect, it } from "vitest";
import { getToolDisabledReason } from "../../src/host/infrastructure/automation/tool-availability";
import type { AutomationTool } from "../../src/shared/models/automation";

const tool = (overrides: Partial<AutomationTool> = {}): AutomationTool => ({
  id: "web_search",
  name: "Поиск в интернете",
  description: "",
  category: "Интернет",
  builtin: true,
  enabled: true,
  requiresConfirmation: false,
  inputSchema: {},
  outputSchema: {},
  secretRequirements: [],
  secretBindings: [],
  ...overrides,
});

describe("доступность инструментов", () => {
  it("объясняет отключение глобальной политикой терминала", () => {
    expect(getToolDisabledReason(tool({ id: "cmd_exec" }), [], false)).toBe(
      "Выполнение команд отключено глобальной политикой терминала.",
    );
  });

  it("перечисляет отсутствующие обязательные секреты", () => {
    expect(
      getToolDisabledReason(
        tool({
          secretRequirements: [
            {
              key: "apiKey",
              label: "API-ключ поиска",
              categoryId: "search",
              required: true,
            },
          ],
        }),
        [],
        true,
      ),
    ).toBe("Не настроены обязательные секреты: API-ключ поиска.");
  });

  it("не возвращает ошибку для настроенного инструмента", () => {
    expect(getToolDisabledReason(tool(), [], true)).toBeNull();
  });
});
