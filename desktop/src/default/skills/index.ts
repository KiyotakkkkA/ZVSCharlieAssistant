import reportDocxInstructions from "./report-docx-gost/SKILL.md?raw";
import managedPowerShellInstructions from "./managed-powershell/SKILL.md?raw";
import createAgentInstructions from "./create-agent/SKILL.md?raw";
import createSkillInstructions from "./create-skill/SKILL.md?raw";
import reportHtmlInstructions from "./report-html/SKILL.md?raw";
import { SYSTEM_SKILL_IDS } from "../../shared/entity-ids";

export interface DefaultSkillDefinition {
  id: string;
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
    id: SYSTEM_SKILL_IDS.reportDocxGost,
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
    id: SYSTEM_SKILL_IDS.managedPowerShell,
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
    id: SYSTEM_SKILL_IDS.createAgent,
    slug: "create-agent",
    name: "Agent creation",
    description:
      "Designs a new executor agent from the user's description of the work and saves it as a draft.",
    version: "1.0.0",
    author: "ZVS Assistant",
    requiredToolIds: ["agent_create"],
    instructions: stripFrontmatter(createAgentInstructions),
  },
  {
    id: SYSTEM_SKILL_IDS.createSkill,
    slug: "create-skill",
    name: "Skill creation",
    description:
      "Writes a new reusable skill with detailed instructions from the user's description and saves it as a draft.",
    version: "1.0.0",
    author: "ZVS Assistant",
    requiredToolIds: ["skill_create"],
    instructions: stripFrontmatter(createSkillInstructions),
  },
  {
    id: SYSTEM_SKILL_IDS.reportHtml,
    slug: "report-html",
    name: "HTML report creation",
    description:
      "Creates a single, self-contained HTML report or document that opens and reads well in any browser, with the design effort calibrated to what the request actually needs.",
    version: "1.0.0",
    author: "ZVS Assistant",
    requiredToolIds: ["fs_write"],
    instructions: stripFrontmatter(reportHtmlInstructions),
  },
] as const;
