import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export function ScenarioNodeConditionForm(props: ScenarioNodeFormProps) {
  return <ScenarioNodeBaseFields {...props} />;
}
