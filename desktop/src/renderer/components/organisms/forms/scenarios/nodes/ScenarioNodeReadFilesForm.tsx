import { InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { Field, ParameterLabel } from "../../../../atoms";
import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export function ScenarioNodeReadFilesForm({
  node,
  onChange,
}: ScenarioNodeFormProps) {
  return (
    <>
      <ScenarioNodeBaseFields node={node} onChange={onChange} />
      <Field
        label={
          <ParameterLabel description="Ограничивает объём текста одного документа, передаваемый оркестратору. Исходный файл не изменяется.">
            Символов на файл
          </ParameterLabel>
        }
      >
        <InputSmall
          type="number"
          min={1000}
          max={1000000}
          value={String(node.config?.maxCharactersPerFile ?? 100000)}
          onChange={(event) =>
            onChange({
              config: {
                ...node.config,
                maxCharactersPerFile: Math.max(
                  1000,
                  Number(event.target.value) || 1000,
                ),
              },
            })
          }
        />
      </Field>
    </>
  );
}
