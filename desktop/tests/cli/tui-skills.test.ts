import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../../src/host/infrastructure/tools/tool.registry";

describe("явно выбранные навыки CLI", () => {
  it("загружает инструкции только выбранного активного навыка", () => {
    const registry = Object.create(ToolRegistry.prototype) as {
      automationCatalog: { listSkills(): unknown[] };
      skillContent: { read(slug: string): string };
      selectedSkillBlock(ids: string[]): string;
    };
    registry.automationCatalog = {
      listSkills: () => [
        {
          id: "skill-1",
          slug: "review",
          name: "Review",
          description: "Review code",
          status: "active",
        },
        {
          id: "skill-2",
          slug: "unused",
          name: "Unused",
          description: "Must stay out",
          status: "active",
        },
      ],
    };
    registry.skillContent = {
      read: (slug) => `instructions:${slug}`,
    };

    const block = registry.selectedSkillBlock(["skill-1"]);
    expect(block).toContain("instructions:review");
    expect(block).not.toContain("instructions:unused");
    expect(block).toContain("не загружай другие навыки самостоятельно");
  });

  it("не допускает отсутствующий навык", () => {
    const registry = Object.create(ToolRegistry.prototype) as {
      automationCatalog: { listSkills(): unknown[] };
      skillContent: { read(slug: string): string };
      selectedSkillBlock(ids: string[]): string;
    };
    registry.automationCatalog = { listSkills: () => [] };
    registry.skillContent = { read: () => "" };

    expect(() => registry.selectedSkillBlock(["missing"])).toThrow(
      "недоступен",
    );
  });
});
