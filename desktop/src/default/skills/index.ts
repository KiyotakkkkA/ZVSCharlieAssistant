import reportDocxInstructions from "./report-docx-gost/SKILL.md?raw";
import managedPowerShellInstructions from "./managed-powershell/SKILL.md?raw";
import createAgentInstructions from "./create-agent/SKILL.md?raw";
import createSkillInstructions from "./create-skill/SKILL.md?raw";

export interface DefaultSkillDefinition {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  requiredToolIds: string[];
  instructions: string;
}

const stripFrontmatter = (value: string) =>
  value.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

export const DEFAULT_SKILLS: readonly DefaultSkillDefinition[] = [
  {
    slug: "report-docx-gost",
    name: "Academic DOCX report formatting",
    description:
      "Creates structured Word reports compliant with GOST 7.32-2017 and RTU MIREA academic formatting requirements.",
    version: "1.1.0",
    author: "ZVS Assistant",
    requiredToolIds: ["reports_docx"],
    instructions: stripFrontmatter(reportDocxInstructions),
  },
  {
    slug: "managed-powershell",
    name: "Managed PowerShell execution",
    description:
      "Runs permitted PowerShell commands for local diagnostics, file operations, and managed background terminal sessions.",
    version: "1.0.0",
    author: "ZVS Assistant",
    requiredToolIds: ["cmd_exec"],
    instructions: stripFrontmatter(managedPowerShellInstructions),
  },
  {
    slug: "create-agent",
    name: "Создание агента",
    description:
      "Проектирует нового агента-исполнителя по описанию задачи от пользователя и сохраняет его черновик.",
    version: "1.0.0",
    author: "ZVS Assistant",
    requiredToolIds: ["agent_create"],
    instructions: stripFrontmatter(createAgentInstructions),
  },
  {
    slug: "create-skill",
    name: "Создание навыка",
    description:
      "Пишет новый переиспользуемый навык с подробными инструкциями по описанию от пользователя и сохраняет его черновик.",
    version: "1.0.0",
    author: "ZVS Assistant",
    requiredToolIds: ["skill_create"],
    instructions: stripFrontmatter(createSkillInstructions),
  },
] as const;
