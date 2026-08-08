import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export function ScenarioNodeOutputForm(props: ScenarioNodeFormProps) {
  return <ScenarioNodeBaseFields {...props} />;
}
