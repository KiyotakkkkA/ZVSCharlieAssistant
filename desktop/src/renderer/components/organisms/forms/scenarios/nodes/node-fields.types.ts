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
  key: string;
  label: string;
  hint?: string;
  placeholder?: string;
  expression?: boolean;
  showIf?: (config: Record<string, unknown>) => boolean;
  half?: boolean;
}

export interface FieldOption {
  value: string;
  label: string;
}

export const equals =
  (key: string, value: unknown) => (config: Record<string, unknown>) =>
    config[key] === value;

export const notEquals =
  (key: string, value: unknown) => (config: Record<string, unknown>) =>
    config[key] !== value;
