import { observer } from "mobx-react-lite";
import {
  Button,
  InputBig,
  InputCheckBox,
  InputSmall,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { ConditionRule } from "../../../../../../shared/scenario/descriptors/flow";
import type { ScenarioNode } from "../../../../../../shared/scenario/graph";
import {
  automationStore,
  integrationStore,
  secretStorageStore,
  vectorStoreStore,
} from "../../../../../stores";
import {
  Field,
  FieldGroup,
  ModelOrientedSelect,
  PlusIcon,
} from "../../../../atoms";
import { ControlButton } from "../../../../atoms/buttons";
import { ExpressionField } from "../../../../molecules";
import { ConditionGroupEditor } from "./ConditionGroupEditor";
import { NODE_FIELDS } from "./node-fields.registry";
import type { FieldOption, NodeFieldSpec } from "./node-fields.types";

type ConfigRecord = Record<string, unknown>;

interface DynamicNodeConfigFormProps {
  node: ScenarioNode;
  onChange(patch: Partial<ScenarioNode>): void;
}

export const DynamicNodeConfigForm = observer(function DynamicNodeConfigForm({
  node,
  onChange,
}: DynamicNodeConfigFormProps) {
  const specs = NODE_FIELDS[node.kind] ?? [];
  const config = (node.config ?? {}) as ConfigRecord;

  const setValue = (key: string, value: unknown) =>
    onChange({ config: { ...config, [key]: value } as ScenarioNode["config"] });

  if (specs.length === 0)
    return (
      <p className="text-xs leading-5 text-main-500">
        У этого узла нет настраиваемых параметров.
      </p>
    );

  return <FieldList specs={specs} config={config} onSet={setValue} />;
});

function FieldList({
  specs,
  config,
  onSet,
}: {
  specs: NodeFieldSpec[];
  config: ConfigRecord;
  onSet(key: string, value: unknown): void;
}) {
  const visible = specs.filter((spec) => !spec.showIf || spec.showIf(config));
  const rows: NodeFieldSpec[][] = [];
  for (const spec of visible) {
    const last = rows.at(-1);
    if (spec.half && last?.length === 1 && last[0]!.half) last.push(spec);
    else rows.push([spec]);
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div
          key={index}
          className={row.length > 1 ? "grid grid-cols-2 gap-3" : undefined}
        >
          {row.map((spec) => (
            <NodeField
              key={`${spec.key}:${spec.label}`}
              spec={spec}
              config={config}
              onSet={onSet}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

const NodeField = observer(function NodeField({
  spec,
  config,
  onSet,
}: {
  spec: NodeFieldSpec;
  config: ConfigRecord;
  onSet(key: string, value: unknown): void;
}) {
  const value = config[spec.key];
  const label = (
    <span className="flex items-center gap-1.5">
      {spec.label}
      {spec.expression ? (
        <span
          className="rounded bg-main-700/70 px-1 py-px font-mono text-[9px] text-main-400"
          title="Поддерживает выражения: {{ $json.field }}. Подсказки — по $, точке или Ctrl+Space"
        >
          {"{{ }}"}
        </span>
      ) : null}
    </span>
  );

  const hint = spec.hint ? (
    <p className="mt-1.5 text-[11px] leading-4 text-main-500">{spec.hint}</p>
  ) : null;

  switch (spec.type) {
    case "boolean":
      return (
        <div>
          <InputCheckBox
            checked={Boolean(value)}
            onChange={(checked) => onSet(spec.key, checked)}
            className="text-xs text-main-300"
          >
            {spec.label}
          </InputCheckBox>
          {hint}
        </div>
      );

    case "textarea":
      return spec.expression ? (
        <ExpressionField
          multiline
          label={label}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(next) => onSet(spec.key, next)}
          placeholder={spec.placeholder}
          minRows={spec.minRows ?? 3}
          maxRows={spec.maxRows ?? 8}
          hint={hint}
        />
      ) : (
        <Field label={label} className="w-full">
          <InputBig
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) => onSet(spec.key, event.target.value)}
            placeholder={spec.placeholder}
            minRows={spec.minRows ?? 3}
            maxRows={spec.maxRows ?? 8}
            autoResize
          />
          {hint}
        </Field>
      );

    case "number":
      return (
        <Field label={label}>
          <InputSmall
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            onChange={(event) =>
              onSet(
                spec.key,
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
            placeholder={spec.placeholder}
            className="w-full"
          />
          {hint}
        </Field>
      );

    case "select":
      return (
        <Field label={label}>
          <OptionSelect
            value={value === null || value === undefined ? "" : String(value)}
            options={spec.options}
            placeholder={spec.placeholder}
            onChange={(next) => onSet(spec.key, next)}
          />
          {hint}
        </Field>
      );

    case "model":
      return (
        <Field label={label}>
          <ModelOrientedSelect
            value={value ? String(value) : ""}
            onChange={(next) => onSet(spec.key, next ? Number(next) : null)}
            className="w-full"
          />
          {hint}
        </Field>
      );

    case "agent":
      return (
        <Field label={label}>
          <OptionSelect
            value={value ? String(value) : ""}
            placeholder="Выберите агента"
            options={automationStore.agents.map((agent) => ({
              value: agent.id,
              label: agent.name,
            }))}
            onChange={(next) => onSet(spec.key, next)}
          />
          {hint}
        </Field>
      );

    case "scenario":
      return (
        <Field label={label}>
          <OptionSelect
            value={value ? String(value) : ""}
            placeholder="Выберите сценарий"
            options={automationStore.scenarios.map((scenario) => ({
              value: scenario.id,
              label: scenario.name,
            }))}
            onChange={(next) => onSet(spec.key, next)}
          />
          {hint}
        </Field>
      );

    case "vectorStore":
      return (
        <Field label={label}>
          <OptionSelect
            value={value ? String(value) : ""}
            placeholder="Выберите хранилище"
            options={vectorStoreStore.stores.map((store) => ({
              value: String(store.id),
              label: store.name,
            }))}
            onChange={(next) => onSet(spec.key, next ? Number(next) : 0)}
          />
          {hint}
        </Field>
      );

    case "secret":
      return (
        <Field label={label}>
          <OptionSelect
            value={value ? String(value) : ""}
            placeholder="Без авторизации"
            options={secretStorageStore.secrets.map((secret) => ({
              value: String(secret.id),
              label: secret.label,
            }))}
            onChange={(next) => onSet(spec.key, next ? Number(next) : null)}
          />
          {hint}
        </Field>
      );

    case "integrationProfile": {
      const wanted =
        spec.channel === "telegram" ? "telegram_bot" : "email_imap";
      return (
        <Field label={label}>
          <OptionSelect
            value={value ? String(value) : ""}
            placeholder="Выберите подключение"
            options={integrationStore.profiles
              .filter((profile) => profile.kind === wanted)
              .map((profile) => ({
                value: String(profile.id),
                label: profile.name,
              }))}
            onChange={(next) => onSet(spec.key, next ? Number(next) : null)}
          />
          {hint}
        </Field>
      );
    }

    case "stringList":
      return (
        <FieldGroup label={label} className="w-full">
          <StringListEditor
            values={Array.isArray(value) ? (value as string[]) : []}
            placeholder={spec.itemPlaceholder}
            onChange={(next) => onSet(spec.key, next)}
          />
          {hint}
        </FieldGroup>
      );

    case "conditions":
      return (
        <FieldGroup label={label} className="w-full">
          <ConditionGroupEditor
            conditions={Array.isArray(value) ? (value as ConditionRule[]) : []}
            onChange={(next) => onSet(spec.key, next)}
          />
          {hint}
        </FieldGroup>
      );

    case "list":
      return (
        <FieldGroup label={label} className="w-full">
          <ObjectListEditor
            spec={spec}
            items={Array.isArray(value) ? (value as ConfigRecord[]) : []}
            onChange={(next) => onSet(spec.key, next)}
          />
          {hint}
        </FieldGroup>
      );

    case "text":
    default:
      return spec.expression ? (
        <ExpressionField
          label={label}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(next) => onSet(spec.key, next)}
          placeholder={spec.placeholder}
          hint={hint}
        />
      ) : (
        <Field label={label}>
          <InputSmall
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(event) => onSet(spec.key, event.target.value)}
            placeholder={spec.placeholder}
            className="w-full"
          />
          {hint}
        </Field>
      );
  }
});


function OptionSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: FieldOption[];
  placeholder?: string;
  onChange(value: string): void;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      className="w-full"
      placeholder={placeholder}
      searchable={options.length > 8}
    >
      <Select.Trigger className="w-full" />
      <Select.Menu>
        {options.map((option) => (
          <Select.Option
            key={option.value}
            value={option.value}
            label={option.label}
          />
        ))}
      </Select.Menu>
    </Select>
  );
}

function StringListEditor({
  values,
  placeholder,
  onChange,
}: {
  values: string[];
  placeholder?: string;
  onChange(values: string[]): void;
}) {
  return (
    <div className="space-y-2">
      {values.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <InputSmall
            value={entry}
            placeholder={placeholder}
            onChange={(event) =>
              onChange(
                values.map((item, position) =>
                  position === index ? event.target.value : item,
                ),
              )
            }
            className="w-full"
          />
          <ControlButton
            icon="trash"
            variant="delete"
            title="Удалить"
            className="shrink-0"
            onClick={() =>
              onChange(values.filter((_, position) => position !== index))
            }
          />
        </div>
      ))}
      <Button
        variant="ghost"
        className="gap-1.5 px-2 text-xs"
        onClick={() => onChange([...values, ""])}
      >
        <PlusIcon className="size-4" />
        Добавить
      </Button>
    </div>
  );
}

function ObjectListEditor({
  spec,
  items,
  onChange,
}: {
  spec: Extract<NodeFieldSpec, { type: "list" }>;
  items: ConfigRecord[];
  onChange(items: ConfigRecord[]): void;
}) {
  const atLimit = spec.max !== undefined && items.length >= spec.max;
  return (
    <div className="space-y-2.5">
      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-lg bg-main-800/60 p-3 ring-1 ring-main-700/70"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-medium text-main-400">
              {spec.itemLabel} {index + 1}
            </span>
            <ControlButton
              icon="trash"
              variant="delete"
              title={`Удалить: ${spec.itemLabel} ${index + 1}`}
              className="size-7"
              onClick={() =>
                onChange(items.filter((_, position) => position !== index))
              }
            />
          </div>
          <FieldList
            specs={spec.fields}
            config={item}
            onSet={(key, value) =>
              onChange(
                items.map((entry, position) =>
                  position === index ? { ...entry, [key]: value } : entry,
                ),
              )
            }
          />
        </div>
      ))}
      {atLimit ? null : (
        <Button
          variant="ghost"
          className="gap-1.5 px-2 text-xs"
          onClick={() => onChange([...items, { ...spec.itemDefaults }])}
        >
          <PlusIcon className="size-4" />
          {spec.addLabel}
        </Button>
      )}
    </div>
  );
}
