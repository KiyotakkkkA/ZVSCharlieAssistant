import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export function ScenarioNodeOrchestratorForm(props: ScenarioNodeFormProps) {
  return <ScenarioNodeBaseFields {...props} />;
}
