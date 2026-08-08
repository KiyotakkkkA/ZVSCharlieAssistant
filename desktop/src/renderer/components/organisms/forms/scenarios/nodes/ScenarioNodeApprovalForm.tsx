import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export function ScenarioNodeApprovalForm(props: ScenarioNodeFormProps) {
  return <ScenarioNodeBaseFields {...props} />;
}
