const SENSITIVE_KEY =
  /(token|secret|password|passwd|api[-_]?key|authorization|cookie|credential|private[-_]?key|bearer|refresh)/i;

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g,
  /\/bot\d{6,12}:[A-Za-z0-9_-]{30,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi,
  /\b(?:sk|pk|rk)-[A-Za-z0-9]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
];

export const REDACTED = "«скрыто»";

const MAX_STRING = 2_000;
const MAX_ARRAY = 50;
const MAX_DEPTH = 6;

export function redactString(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS)
    result = result.replace(pattern, REDACTED);
  return result;
}

function truncate(value: string): string {
  if (value.length <= MAX_STRING) return value;
  return `${value.slice(0, MAX_STRING)}…(+${value.length - MAX_STRING})`;
}

export function sanitize(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(redactString(value));
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "function") return "«функция»";
  if (typeof value === "symbol") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (depth >= MAX_DEPTH) return "«глубина превышена»";

  if (typeof value === "object") {
    if (seen.has(value)) return "«цикл»";
    seen.add(value);

    if (Array.isArray(value)) {
      const head = value
        .slice(0, MAX_ARRAY)
        .map((item) => sanitize(item, depth + 1, seen));
      return value.length > MAX_ARRAY
        ? [...head, `…(+${value.length - MAX_ARRAY} элементов)`]
        : head;
    }
    if (value instanceof Map)
      return sanitize(
        Object.fromEntries([...value.entries()].slice(0, MAX_ARRAY)),
        depth + 1,
        seen,
      );
    if (value instanceof Set)
      return sanitize([...value.values()].slice(0, MAX_ARRAY), depth + 1, seen);
    if (Buffer.isBuffer(value)) return `«buffer ${value.byteLength} байт»`;

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = SENSITIVE_KEY.test(key)
        ? REDACTED
        : sanitize(item, depth + 1, seen);
    }
    return result;
  }
  return String(value);
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  cause?: unknown;
}

export function serializeError(error: unknown): SerializedError {
  if (!(error instanceof Error))
    return { name: "NonError", message: truncate(redactString(String(error))) };
  const result: SerializedError = {
    name: error.name,
    message: truncate(redactString(error.message)),
  };
  if (error.stack) result.stack = truncate(redactString(error.stack));
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" || typeof code === "number")
    result.code = String(code);
  if (error.cause !== undefined && error.cause !== null)
    result.cause =
      error.cause instanceof Error
        ? serializeError(error.cause)
        : sanitize(error.cause);
  return result;
}
