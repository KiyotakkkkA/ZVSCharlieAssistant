import type { ScenarioNode } from "../../../../../../shared/scenario/graph";

/**
 * Declarative description of one configuration field of a scenario node.
 *
 * The v2 config schemas (`shared/scenario/config-fields.ts`) are deliberately
 * built on `z.unknown().transform(...)` so a field can hold either a literal
 * value or an expression (`{{ $json.x }}`). That erases the structural
 * information a form renderer would need, so the UI shape of every field is
 * described here instead of being derived from the zod schema.
 */
export type NodeFieldSpec =
  | BaseSpec<"text">
  | (BaseSpec<"textarea"> & { minRows?: number; maxRows?: number })
  | (BaseSpec<"number"> & { min?: number; max?: number; step?: number })
  | BaseSpec<"boolean">
  | (BaseSpec<"select"> & { options: FieldOption[] })
  | BaseSpec<"model">
  | BaseSpec<"agent">
  | BaseSpec<"vectorStore">
  | BaseSpec<"secret">
  | BaseSpec<"scenario">
  | (BaseSpec<"integrationProfile"> & { channel: "telegram" | "email" })
  | (BaseSpec<"stringList"> & { itemPlaceholder?: string })
  | (BaseSpec<"list"> & {
      itemLabel: string;
      addLabel: string;
      fields: NodeFieldSpec[];
      itemDefaults: Record<string, unknown>;
      max?: number;
    })
  | BaseSpec<"conditions">;

interface BaseSpec<T extends string> {
  type: T;
  /** Key inside `node.config`. Nested keys are not supported by design. */
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  /** Whether the field accepts `{{ expressions }}` — shown as a hint badge. */
  expression?: boolean;
  /** Hide the field unless this predicate passes against the current config. */
  showIf?: (config: Record<string, unknown>) => boolean;
  /** Render the field at half width inside a two-column row. */
  half?: boolean;
}

export interface FieldOption {
  value: string;
  label: string;
}

export const equals = (key: string, value: unknown) => (
  config: Record<string, unknown>,
) => config[key] === value;

export const notEquals = (key: string, value: unknown) => (
  config: Record<string, unknown>,
) => config[key] !== value;
