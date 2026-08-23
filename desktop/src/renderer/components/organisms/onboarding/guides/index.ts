import { accessGuide } from "./access";
import { agentsGuide } from "./agents";
import { beginningGuide } from "./beginning";
import { chatGuide } from "./chat";
import { integrationsGuide } from "./integrations";
import { knowledgeGuide } from "./knowledge";
import { providersGuide } from "./providers";
import { scenariosGuide } from "./scenarios";
import { secretsGuide } from "./secrets";
import { skillsGuide } from "./skills";
import { tasksGuide } from "./tasks";
import { toolsGuide } from "./tools";

export type { Guide, GuideStep } from "./types";

export const GUIDES = [
  beginningGuide,
  providersGuide,
  chatGuide,
  tasksGuide,
  agentsGuide,
  toolsGuide,
  skillsGuide,
  scenariosGuide,
  secretsGuide,
  knowledgeGuide,
  accessGuide,
  integrationsGuide,
] as const;

export type GuideId = (typeof GUIDES)[number]["id"];

export function findGuide(id: string | null | undefined) {
  return GUIDES.find((guide) => guide.id === id);
}
