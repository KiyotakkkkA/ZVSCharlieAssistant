import { InputBig, Select } from "@kiyotakkkka/zvs-uikit-lib";
import type { AutomationAgent } from "../../../../../../shared/models/automation";
import { Field } from "../../../../atoms";
import { ScenarioNodeBaseFields } from "./ScenarioNodeBaseFields";
import type { ScenarioNodeFormProps } from "./ScenarioNodeForm.types";

interface ScenarioNodeAgentFormProps extends ScenarioNodeFormProps {
  agents: AutomationAgent[];
}

export function ScenarioNodeAgentForm({
  node,
  agents,
  onChange,
}: ScenarioNodeAgentFormProps) {
  return (
    <>
      <ScenarioNodeBaseFields node={node} onChange={onChange} />
      <Field label="Агент">
        <Select
          value={String(node.config?.agentId ?? "")}
          onChange={(agentId) =>
            onChange({
              config: { ...node.config, agentId },
              description:
                agents.find((agent) => agent.id === agentId)?.name ??
                node.description,
            })
          }
          options={agents.map((agent) => ({
            value: agent.id,
            label: agent.name,
          }))}
          className="w-full"
          placeholder="Выберите агента"
          searchable
        >
          <Select.Trigger className="w-full" />
          <Select.Menu>
            {agents.map((agent) => (
              <Select.Option
                key={agent.id}
                value={agent.id}
                label={agent.name}
              />
            ))}
          </Select.Menu>
        </Select>
      </Field>
      <Field label="Инструкции для сценария" className="w-full">
        <InputBig
          value={String(node.config?.scenarioInstructions ?? "")}
          onChange={(event) =>
            onChange({
              config: {
                ...node.config,
                scenarioInstructions: event.target.value,
              },
            })
          }
          placeholder="Уточните роль агента, формат и ограничения результата"
          minRows={4}
          maxRows={9}
          autoResize
        />
      </Field>
    </>
  );
}
