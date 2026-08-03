import reportDocxInstructions from "./report-docx-gost/SKILL.md?raw";

export interface DefaultSkillDefinition {
  slug: string;
  name: string;
  description: string;
  version: string;
  author: string;
  requiredToolIds: string[];
  instructions: string;
}

const instructions = reportDocxInstructions.replace(
  /^---\r?\n[\s\S]*?\r?\n---\r?\n/,
  "",
);

export const DEFAULT_SKILLS: readonly DefaultSkillDefinition[] = [
  {
    slug: "report-docx-gost",
    name: "Academic DOCX report formatting",
    description:
      "Creates structured Word reports compliant with GOST 7.32-2017 and RTU MIREA academic formatting requirements.",
    version: "1.1.0",
    author: "ZVS Assistant",
    requiredToolIds: ["reports_docx"],
    instructions,
  },
] as const;
