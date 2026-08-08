import type { AutomationScenarioNode } from "../../../../../../shared/dto";

export interface ScenarioNodeFormProps {
  node: AutomationScenarioNode;
  onChange(patch: Partial<AutomationScenarioNode>): void;
}
