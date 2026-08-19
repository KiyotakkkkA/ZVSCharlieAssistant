import {
  EXPRESSION_COMPLETIONS,
  type CompletionEntry,
} from "../../../../shared/expressions";

const SCAN_WINDOW = 160;
const MAX_SUGGESTIONS = 50;
const MAX_KEYS = 200;

export type ContextKind = "root" | "member" | "nodeName";

export interface CompletionContext {
  kind: ContextKind;
  token: string;
  from: number;
  receiver?: { root: string; nodeName?: string; path: string[] };
}

export interface Suggestion extends CompletionEntry {
  insert: { text: string; caret: number };
}

export interface ExpressionScope {
  nodeNames: readonly string[];
  values: Record<string, unknown>;
}

export const EMPTY_SCOPE: ExpressionScope = { nodeNames: [], values: {} };

const ROOT_ENTRIES = EXPRESSION_COMPLETIONS.filter(
  (entry) => entry.kind === "variable" || entry.kind === "function",
);
const METHODS_BY_RECEIVER = new Map<string, CompletionEntry[]>();
for (const entry of EXPRESSION_COMPLETIONS) {
  if (entry.kind !== "method") continue;
  const bucket = METHODS_BY_RECEIVER.get(entry.receiver ?? "object") ?? [];
  bucket.push(entry);
  METHODS_BY_RECEIVER.set(entry.receiver ?? "object", bucket);
}
const ALL_METHODS = EXPRESSION_COMPLETIONS.filter(
  (entry) => entry.kind === "method",
);

const NODE_NAME = /\$node\[\s*["']([^"']*)$/;
const MEMBER =
  /(\$[A-Za-z_]\w*(?:\[\s*["'][^"']*["']\s*\])?)((?:\s*\.\s*[A-Za-z_]\w*)*)\s*\.\s*([A-Za-z_]\w*)?$/;
const ROOT = /(\$[A-Za-z_]*)$/;
const OPEN_TEMPLATE = /\{\{\s*$/;

export function readContext(
  source: string,
  caret: number,
): CompletionContext | null {
  const before = source.slice(Math.max(0, caret - SCAN_WINDOW), caret);

  const node = NODE_NAME.exec(before);
  if (node) {
    const token = node[1] ?? "";
    return { kind: "nodeName", token, from: caret - token.length };
  }

  const member = MEMBER.exec(before);
  if (member) {
    const token = member[3] ?? "";
    const rootExpression = member[1] ?? "";
    const nodeName = /\$node\[\s*["']([^"']*)["']/.exec(rootExpression)?.[1];
    const path = (member[2] ?? "")
      .split(".")
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      kind: "member",
      token,
      from: caret - token.length,
      receiver: { root: nodeName ? "$node" : rootExpression, nodeName, path },
    };
  }

  const root = ROOT.exec(before);
  if (root) {
    const token = root[1] ?? "";
    return { kind: "root", token, from: caret - token.length };
  }

  if (OPEN_TEMPLATE.test(before))
    return { kind: "root", token: "", from: caret };

  return null;
}

interface CompletionSource {
  handles(context: CompletionContext): boolean;
  entries(
    context: CompletionContext,
    scope: ExpressionScope,
  ): CompletionEntry[];
}

const nodeNames: CompletionSource = {
  handles: (context) => context.kind === "nodeName",
  entries: (_context, scope) =>
    scope.nodeNames.map((name) => ({
      label: name,
      kind: "variable" as const,
      detail: "Узел этого сценария",
    })),
};

const dataFields: CompletionSource = {
  handles: (context) => context.kind === "member",
  entries: (context, scope) => {
    const value = resolvePath(context, scope);
    if (!isRecord(value)) return [];
    return Object.keys(value)
      .slice(0, MAX_KEYS)
      .map((key) => ({
        label: key,
        kind: "variable" as const,
        detail: describe(value[key]),
      }));
  },
};

const methods: CompletionSource = {
  handles: (context) => context.kind === "member",
  entries: (context, scope) => {
    const receiver = receiverOf(resolvePath(context, scope));
    return receiver ? (METHODS_BY_RECEIVER.get(receiver) ?? []) : ALL_METHODS;
  },
};

const roots: CompletionSource = {
  handles: (context) => context.kind === "root",
  entries: () => ROOT_ENTRIES,
};

const SOURCES: CompletionSource[] = [nodeNames, dataFields, methods, roots];

export function suggest(
  context: CompletionContext | null,
  scope: ExpressionScope,
): Suggestion[] {
  if (!context) return [];

  const pool: CompletionEntry[] = [];
  for (const source of SOURCES)
    if (source.handles(context)) pool.push(...source.entries(context, scope));

  const token = context.token.toLowerCase();
  const starts: CompletionEntry[] = [];
  const contains: CompletionEntry[] = [];
  for (const entry of pool) {
    if (!token) {
      starts.push(entry);
      continue;
    }
    const label = entry.label.toLowerCase();
    if (label.startsWith(token)) starts.push(entry);
    else if (label.includes(token)) contains.push(entry);
  }

  return [...starts, ...contains]
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => ({ ...entry, insert: insertionFor(entry, context.kind) }));
}

function resolvePath(
  context: CompletionContext,
  scope: ExpressionScope,
): unknown {
  const receiver = context.receiver;
  if (!receiver) return undefined;

  let value = scope.values[receiver.root];
  if (receiver.nodeName)
    value = isRecord(value) ? value[receiver.nodeName] : undefined;
  for (const key of receiver.path) {
    if (!isRecord(value)) return undefined;
    value = value[key];
  }
  return value;
}

function receiverOf(value: unknown): string | null {
  if (typeof value === "string") return "string";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  if (isRecord(value)) return "object";
  return null;
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `список, ${value.length}`;
  switch (typeof value) {
    case "string":
      return value.length > 32 ? `"${value.slice(0, 32)}…"` : `"${value}"`;
    case "number":
    case "boolean":
      return String(value);
    case "object":
      return "объект";
    default:
      return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function insertionFor(
  entry: CompletionEntry,
  kind: ContextKind,
): { text: string; caret: number } {
  if (kind === "nodeName")
    return { text: entry.label, caret: entry.label.length };

  if (entry.kind === "function" || entry.kind === "method") {
    if (entry.signature === "")
      return { text: entry.label, caret: entry.label.length };
    const open = `${entry.label}(`;
    const takesArguments = Boolean(entry.signature && entry.signature !== "()");
    return {
      text: `${open})`,
      caret: takesArguments ? open.length : open.length + 1,
    };
  }

  return { text: entry.label, caret: entry.label.length };
}
