import { describe, expect, it } from "vitest";
import { BUILTIN_AUTOMATION_TOOLS } from "../../src/host/infrastructure/automation/builtin-tools.registry";
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
  it("создаёт DOCX-отчёт без дополнительного подтверждения", () => {
    const reportTool = BUILTIN_AUTOMATION_TOOLS.find(
      ({ id }) => id === "reports_docx",
    );

    expect(reportTool?.requiresConfirmation).toBe(false);
  });

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
