import { Button, InputCheckBox, InputSmall, Select } from "@kiyotakkkka/zvs-uikit-lib";
import {
  UNARY_OPERATORS,
  type ComparisonOperator,
  type ConditionRule,
} from "../../../../../../shared/scenario/descriptors/flow";
import { PlusIcon } from "../../../../atoms";
import { ControlButton } from "../../../../atoms/buttons";
import { OPERATOR_OPTIONS } from "./node-fields.registry";

const emptyCondition = (): ConditionRule => ({
  left: "",
  operator: "equals",
  right: "",
  caseSensitive: false,
});

interface ConditionGroupEditorProps {
  conditions: ConditionRule[];
  onChange(conditions: ConditionRule[]): void;
}

export function ConditionGroupEditor({
  conditions,
  onChange,
}: ConditionGroupEditorProps) {
  const patch = (index: number, next: Partial<ConditionRule>) =>
    onChange(
      conditions.map((item, position) =>
        position === index ? { ...item, ...next } : item,
      ),
    );

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const unary = UNARY_OPERATORS.has(
          condition.operator as ComparisonOperator,
        );
        return (
          <div
            key={index}
            className="rounded-lg bg-main-800/60 p-2.5 ring-1 ring-main-700/70"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <InputSmall
                  value={String(condition.left ?? "")}
                  onChange={(event) => patch(index, { left: event.target.value })}
                  placeholder="{{ $json.status }}"
                  className="w-full font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Select
                    value={condition.operator}
                    onChange={(operator) =>
                      patch(index, { operator: operator as ComparisonOperator })
                    }
                    options={OPERATOR_OPTIONS}
                    className="w-40 shrink-0"
                  >
                    <Select.Trigger className="w-full" />
                    <Select.Menu>
                      {OPERATOR_OPTIONS.map((option) => (
                        <Select.Option
                          key={option.value}
                          value={option.value}
                          label={option.label}
                        />
                      ))}
                    </Select.Menu>
                  </Select>
                  {unary ? null : (
                    <InputSmall
                      value={String(condition.right ?? "")}
                      onChange={(event) =>
                        patch(index, { right: event.target.value })
                      }
                      placeholder="значение или выражение"
                      className="w-full font-mono text-xs"
                    />
                  )}
                </div>
                {unary ? null : (
                  <InputCheckBox
                    checked={Boolean(condition.caseSensitive)}
                    onChange={(checked) =>
                      patch(index, { caseSensitive: checked })
                    }
                    className="text-xs text-main-400"
                  >
                    Учитывать регистр
                  </InputCheckBox>
                )}
              </div>
              <ControlButton
                icon="trash"
                variant="delete"
                title="Удалить условие"
                className="shrink-0"
                onClick={() =>
                  onChange(conditions.filter((_, position) => position !== index))
                }
              />
            </div>
          </div>
        );
      })}
      <Button
        variant="ghost"
        className="gap-1.5 px-2 text-xs"
        onClick={() => onChange([...conditions, emptyCondition()])}
      >
        <PlusIcon className="size-4" />
        Добавить условие
      </Button>
    </div>
  );
}
