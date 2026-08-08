import { InputBig, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { Field } from "../../../../atoms";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export function ScenarioNodeBaseFields({ node, onChange }: ScenarioNodeFormProps) {
  return (
    <>
      <Field label="Название">
        <InputSmall
          value={node.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </Field>
      <Field label="Описание">
        <InputBig
          value={node.description}
          onChange={(event) => onChange({ description: event.target.value })}
          minRows={3}
          maxRows={6}
          autoResize
        />
      </Field>
    </>
  );
}
