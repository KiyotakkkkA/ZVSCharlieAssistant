import { InputCheckBox, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { Field, ParameterLabel } from "../../../../atoms";
import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

export function ScenarioNodeDownloadFilesForm({
  node,
  onChange,
}: ScenarioNodeFormProps) {
  return (
    <>
      <ScenarioNodeBaseFields node={node} onChange={onChange} />
      <Field
        label={
          <ParameterLabel description="Предельный размер каждого отдельного вложения. Файлы большего размера будут отклонены.">
            Максимальный размер файла, МБ
          </ParameterLabel>
        }
      >
        <InputSmall
          type="number"
          min={1}
          max={1024}
          value={String(node.config?.maxFileSizeMb ?? 50)}
          onChange={(event) =>
            onChange({
              config: {
                ...node.config,
                maxFileSizeMb: Math.max(1, Number(event.target.value) || 1),
              },
            })
          }
        />
      </Field>
      <InputCheckBox
        checked={Boolean(node.config?.cleanupOnFinish ?? true)}
        onChange={(cleanupOnFinish) =>
          onChange({ config: { ...node.config, cleanupOnFinish } })
        }
      >
        <ParameterLabel description="Распространяется и на завершение сценария с ошибкой">
          Удалять временные файлы после завершения запуска
        </ParameterLabel>
      </InputCheckBox>
    </>
  );
}
