import {
  ExpressionSyntaxError,
  tokenize,
  type Token,
} from "../../../../shared/expressions";

export type SpanKind =
  | "text"
  | "brace"
  | "variable"
  | "field"
  | "string"
  | "number"
  | "punctuation"
  | "error";

export interface HighlightSpan {
  start: number;
  end: number;
  kind: SpanKind;
}

export const SPAN_CLASS: Record<SpanKind, string> = {
  text: "text-main-200",
  brace: "text-accent-light",
  variable: "text-accent-light",
  field: "text-info-light",
  string: "text-success-light",
  number: "text-warning-light",
  punctuation: "text-main-500",
  error: "text-danger-light underline decoration-wavy decoration-danger-medium",
};

const TOKEN_KIND: Record<Token["type"], SpanKind> = {
  variable: "variable",
  identifier: "field",
  string: "string",
  number: "number",
  punctuator: "punctuation",
  eof: "punctuation",
};

interface RawSegment {
  open: number;
  close: number;
  closed: boolean;
}

function scan(source: string): RawSegment[] {
  const segments: RawSegment[] = [];
  let index = 0;

  while (index < source.length) {
    if (source.startsWith("\\{{", index)) {
      index += 3;
      continue;
    }
    if (!source.startsWith("{{", index)) {
      index += 1;
      continue;
    }

    const open = index;
    index += 2;
    let depth = 1;
    let quote: string | undefined;

    while (index < source.length && depth > 0) {
      const char = source[index]!;
      if (quote) {
        if (char === "\\") index += 2;
        else {
          if (char === quote) quote = undefined;
          index += 1;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
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
        index += 2;
        continue;
      }
      index += 1;
    }

    segments.push({ open, close: index, closed: depth === 0 });
  }

  return segments;
}

export function highlight(source: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];

  for (const segment of scan(source)) {
    const innerStart = segment.open + 2;
    const innerEnd = segment.closed ? segment.close - 2 : segment.close;

    spans.push({ start: segment.open, end: innerStart, kind: "brace" });
    if (segment.closed)
      spans.push({ start: innerEnd, end: segment.close, kind: "brace" });

    if (innerEnd <= innerStart) continue;
    const inner = source.slice(innerStart, innerEnd);

    try {
      for (const token of tokenize(inner)) {
        if (token.type === "eof" || token.end <= token.start) continue;
        spans.push({
          start: innerStart + token.start,
          end: innerStart + token.end,
          kind: TOKEN_KIND[token.type],
        });
      }
    } catch (error) {
      const from =
        error instanceof ExpressionSyntaxError
          ? innerStart + Math.max(0, Math.min(error.position, inner.length))
          : innerStart;
      spans.push({ start: from, end: innerEnd, kind: "error" });
    }
  }

  return fill(spans, source.length);
}

function fill(spans: HighlightSpan[], length: number): HighlightSpan[] {
  const sorted = spans
    .filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start);

  const result: HighlightSpan[] = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue;
    if (span.start > cursor)
      result.push({ start: cursor, end: span.start, kind: "text" });
    result.push(span);
    cursor = span.end;
  }
  if (cursor < length)
    result.push({ start: cursor, end: length, kind: "text" });
  return result;
}
