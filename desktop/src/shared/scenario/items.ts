export interface ScenarioBinaryRef {
  id: number;
  fileName: string;
  mimeType: string | null;
  size: number;
  sha256: string;
  storageKey: string;
}

export interface ScenarioItemError {
  message: string;
  nodeId: string;
  code?: string;
}

export interface ScenarioItem {
  json: unknown;
  binary?: Record<string, ScenarioBinaryRef>;
  pairedItem?: number;
  error?: ScenarioItemError;
}

export type ScenarioItems = ScenarioItem[];

export const MAIN_PORT = "main";
export const ERROR_PORT = "error";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeItem(value: unknown): value is ScenarioItem {
  return isRecord(value) && "json" in value;
}

export function toItem(value: unknown, pairedItem?: number): ScenarioItem {
  if (looksLikeItem(value))
    return pairedItem === undefined ? value : { ...value, pairedItem };
  return pairedItem === undefined
    ? { json: value }
    : { json: value, pairedItem };
}

export function toItems(value: unknown): ScenarioItems {
  if (value === undefined) return [];
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    return value.map((entry, index) => toItem(entry, index));
  }
  if (looksLikeItem(value)) return [value];
  if (value === null) return [{ json: null }];
  return [{ json: value }];
}

export function concatItems(...groups: ScenarioItems[]): ScenarioItems {
  const result: ScenarioItems = [];
  for (const group of groups) result.push(...group);
  return result;
}

export function itemsToPromptValue(items: ScenarioItems): unknown {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0]!.json;
  return items.map((item) => item.json);
}

export function markItemsFailed(
  items: ScenarioItems,
  error: ScenarioItemError,
): ScenarioItems {
  return items.map((item) => ({ ...item, error }));
}
