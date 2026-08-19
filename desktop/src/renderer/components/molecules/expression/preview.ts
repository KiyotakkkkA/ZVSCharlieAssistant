import { resolveTemplate } from "../../../../shared/expressions";
import type { ExpressionScope } from "./completions";

export type PreviewResult =
  | { state: "empty" }
  | { state: "value"; text: string; type: string }
  | { state: "error"; message: string };

const TYPE_NAMES: Record<string, string> = {
  string: "текст",
  number: "число",
  boolean: "да/нет",
  object: "объект",
  array: "список",
  undefined: "пусто",
};

export function preview(
  source: string,
  scope: ExpressionScope,
): PreviewResult {
  if (!source.trim()) return { state: "empty" };

  try {
    const value = resolveTemplate(source, {
      scope: scope.values,
      onError: "throw",
    });
    return {
      state: "value",
      text: display(value),
      type: TYPE_NAMES[typeName(value)] ?? typeName(value),
    };
  } catch (error) {
    return {
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function typeName(value: unknown): string {
  if (value === null || value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function display(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "да" : "нет";
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
