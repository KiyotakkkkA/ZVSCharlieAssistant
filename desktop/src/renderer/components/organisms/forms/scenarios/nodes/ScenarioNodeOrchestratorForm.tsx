import { observer } from "mobx-react-lite";
import { Field, ModelOrientedSelect } from "../../../../atoms";
import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export const ScenarioNodeOrchestratorForm = observer(
  function ScenarioNodeOrchestratorForm({
    node,
    onChange,
  }: ScenarioNodeFormProps) {
    const value = node.config?.modelId
      ? String(node.config.modelId)
      : "";

    return (
      <>
        <ScenarioNodeBaseFields node={node} onChange={onChange} />
        <Field label="Модель">
          <ModelOrientedSelect
            variant="select"
            value={value}
            onChange={(modelId) =>
              onChange({
                config: {
                  ...node.config,
                  modelId: Number(modelId),
                },
              })
            }
            placeholder="Выберите модель"
          />
        </Field>
      </>
    );
  },
);
