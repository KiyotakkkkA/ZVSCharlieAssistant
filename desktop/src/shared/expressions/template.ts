import { evaluateExpression, type ExpressionScope } from "./evaluate";
import { ExpressionRuntimeError, toText } from "./functions";
import { ExpressionSyntaxError, parseExpression } from "./parser";

export interface TemplateSegment {
  kind: "text" | "expression";
  value: string;
  start: number;
  end: number;
}

export function parseTemplate(source: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let text = "";
  let textStart = 0;
  let index = 0;

  const flushText = (end: number): void => {
    if (text === "") return;
    segments.push({ kind: "text", value: text, start: textStart, end });
    text = "";
  };

  while (index < source.length) {
    if (source.startsWith("\\{{", index)) {
      text += "{{";
      index += 3;
      continue;
    }
    if (!source.startsWith("{{", index)) {
      if (text === "") textStart = index;
      text += source[index];
      index += 1;
      continue;
    }

    const open = index;
    index += 2;
    let depth = 1;
    let quote: string | undefined;
    let expression = "";

    while (index < source.length && depth > 0) {
      const char = source[index]!;
      if (quote) {
        if (char === "\\") {
          expression += char + (source[index + 1] ?? "");
          index += 2;
          continue;
        }
        if (char === quote) quote = undefined;
        expression += char;
        index += 1;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        expression += char;
        index += 1;
        continue;
      }
      if (source.startsWith("}}", index)) {
        depth -= 1;
        index += 2;
        break;
      }
      if (source.startsWith("{{", index)) {
        depth += 1;
        expression += "{{";
        index += 2;
        continue;
      }
      expression += char;
      index += 1;
    }

    if (depth > 0) {
      if (text === "") textStart = open;
      text += source.slice(open);
      index = source.length;
      break;
    }

    flushText(open);
    segments.push({
      kind: "expression",
      value: expression.trim(),
      start: open,
      end: index,
    });
  }

  flushText(source.length);
  return segments;
}

export function hasExpression(value: string): boolean {
  return parseTemplate(value).some((segment) => segment.kind === "expression");
}

export type ExpressionErrorMode = "throw" | "empty" | "keep";

export interface ResolveOptions {
  scope: ExpressionScope;
  onError?: ExpressionErrorMode;
  onErrorReport?: (source: string, error: unknown) => void;
}

export class ExpressionEvaluationError extends Error {
  constructor(
    readonly source: string,
    readonly cause: unknown,
    readonly path?: string,
  ) {
    const reason =
      cause instanceof ExpressionSyntaxError ||
      cause instanceof ExpressionRuntimeError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : String(cause);
    super(
      path
        ? `Ошибка в выражении «${source}» (поле ${path}): ${reason}`
        : `Ошибка в выражении «${source}»: ${reason}`,
    );
    this.name = "ExpressionEvaluationError";
  }
}

export function resolveTemplate(
  source: string,
  options: ResolveOptions,
): unknown {
  const segments = parseTemplate(source);
  if (segments.length === 0) return source;
  if (!segments.some((segment) => segment.kind === "expression"))
    return segments.map((segment) => segment.value).join("");

  const evaluate = (expression: string): unknown => {
    try {
      return evaluateExpression(expression, options.scope);
    } catch (error) {
      options.onErrorReport?.(expression, error);
      const mode = options.onError ?? "throw";
      if (mode === "throw")
        throw new ExpressionEvaluationError(expression, error);
      if (mode === "keep") return `{{ ${expression} }}`;
      return "";
    }
  };

  if (segments.length === 1 && segments[0]!.kind === "expression")
    return evaluate(segments[0]!.value);

  return segments
    .map((segment) =>
      segment.kind === "text" ? segment.value : toText(evaluate(segment.value)),
    )
    .join("");
}

const MAX_RESOLVE_DEPTH = 12;

export function resolveDeep<T>(
  value: T,
  options: ResolveOptions,
  path = "",
  depth = 0,
): T {
  if (depth > MAX_RESOLVE_DEPTH) return value;

  if (typeof value === "string") {
    try {
      return resolveTemplate(value, options) as T;
    } catch (error) {
      if (error instanceof ExpressionEvaluationError && path)
        throw new ExpressionEvaluationError(error.source, error.cause, path);
      throw error;
    }
  }

  if (Array.isArray(value))
    return value.map((item, index) =>
      resolveDeep(item, options, `${path}[${index}]`, depth + 1),
    ) as unknown as T;

  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      result[key] = resolveDeep(
        item,
        options,
        path ? `${path}.${key}` : key,
        depth + 1,
      );
    return result as T;
  }

  return value;
}

export function collectExpressions(
  value: unknown,
  path = "",
  output: Array<{ path: string; source: string }> = [],
): Array<{ path: string; source: string }> {
  if (typeof value === "string") {
    for (const segment of parseTemplate(value))
      if (segment.kind === "expression")
        output.push({ path, source: segment.value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectExpressions(item, `${path}[${index}]`, output),
    );
    return output;
  }
  if (value !== null && typeof value === "object")
    for (const [key, item] of Object.entries(value as Record<string, unknown>))
      collectExpressions(item, path ? `${path}.${key}` : key, output);
  return output;
}

export function validateExpressions(
  value: unknown,
): Array<{ path: string; source: string; message: string }> {
  const issues: Array<{ path: string; source: string; message: string }> = [];
  for (const { path, source } of collectExpressions(value)) {
    if (source.trim() === "") {
      issues.push({ path, source, message: "Пустая вставка «{{ }}»" });
      continue;
    }
    try {
      parseExpression(source);
    } catch (error) {
      issues.push({
        path,
        source,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return issues;
}
