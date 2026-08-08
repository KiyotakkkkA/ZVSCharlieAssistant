import { Select } from "@kiyotakkkka/zvs-uikit-lib";
import type { VectorStoreConfig } from "../../../../../../shared/models/vector-store";
import { Field } from "../../../../atoms";
import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

interface ScenarioNodeKnowledgeStoreFormProps extends ScenarioNodeFormProps {
  stores: VectorStoreConfig[];
}

export function ScenarioNodeKnowledgeStoreForm({
  node,
  stores,
  onChange,
}: ScenarioNodeKnowledgeStoreFormProps) {
  const readyStores = stores.filter((item) => item.status === "ready");
  return (
    <>
      <ScenarioNodeBaseFields node={node} onChange={onChange} />
      <Field label="Векторное хранилище">
        <Select
          value={String(node.config?.vectorStoreId ?? "")}
          onChange={(value) => {
            const vectorStoreId = Number(value);
            onChange({
              config: { ...node.config, vectorStoreId },
              description:
                stores.find((item) => item.id === vectorStoreId)?.name ??
                node.description,
            });
          }}
          options={readyStores.map((item) => ({
            value: String(item.id),
            label: item.name,
          }))}
          className="w-full"
          placeholder="Выберите хранилище"
          searchable
        >
          <Select.Trigger className="w-full" />
          <Select.Menu>
            {readyStores.map((item) => (
              <Select.Option
                key={item.id}
                value={String(item.id)}
                label={item.name}
              />
            ))}
          </Select.Menu>
        </Select>
      </Field>
    </>
  );
}
