const CONTEXT_LINES = 3;
const LCS_LINE_LIMIT = 4_000;
const APPLY_FUZZ_LINES = 60;

export interface DiffStats {
  added: number;
  removed: number;
}

export function splitLines(text: string): string[] {
  if (text === "") return [];
  return text.split(/\r\n|\n|\r/);
}

export function createUnifiedDiff(
  path: string,
  before: string,
  after: string,
): { diff: string; stats: DiffStats } {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  if (before === after) return { diff: "", stats: { added: 0, removed: 0 } };

  const operations =
    beforeLines.length + afterLines.length > LCS_LINE_LIMIT
      ? wholeFileOperations(beforeLines, afterLines)
      : diffLines(beforeLines, afterLines);

  const hunks = groupHunks(operations);
  const stats: DiffStats = { added: 0, removed: 0 };
  for (const op of operations) {
    if (op.kind === "add") stats.added += 1;
    if (op.kind === "remove") stats.removed += 1;
  }

  const header = `--- a/${path}\n+++ b/${path}\n`;
  const body = hunks
    .map((hunk) => {
      const head = `@@ -${hunk.beforeStart},${hunk.beforeCount} +${hunk.afterStart},${hunk.afterCount} @@`;
      const lines = hunk.operations.map((op) =>
        op.kind === "equal"
          ? ` ${op.text}`
          : op.kind === "add"
            ? `+${op.text}`
            : `-${op.text}`,
      );
      return [head, ...lines].join("\n");
    })
    .join("\n");
  return { diff: `${header}${body}\n`, stats };
}

interface Operation {
  kind: "equal" | "add" | "remove";
  text: string;
}

function wholeFileOperations(before: string[], after: string[]): Operation[] {
  return [
    ...before.map((text): Operation => ({ kind: "remove", text })),
    ...after.map((text): Operation => ({ kind: "add", text })),
  ];
}

function diffLines(before: string[], after: string[]): Operation[] {
  const rows = before.length;
  const columns = after.length;
  const width = columns + 1;
  const table = new Int32Array((rows + 1) * width);
  const at = (i: number, j: number): number => table[i * width + j] ?? 0;
  const left = (i: number): string => before[i] ?? "";
  const right = (j: number): string => after[j] ?? "";

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        left(i) === right(j)
          ? at(i + 1, j + 1) + 1
          : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const operations: Operation[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (left(i) === right(j)) {
      operations.push({ kind: "equal", text: left(i) });
      i += 1;
      j += 1;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      operations.push({ kind: "remove", text: left(i) });
      i += 1;
    } else {
      operations.push({ kind: "add", text: right(j) });
      j += 1;
    }
  }
  while (i < rows) {
    operations.push({ kind: "remove", text: left(i) });
    i += 1;
  }
  while (j < columns) {
    operations.push({ kind: "add", text: right(j) });
    j += 1;
  }
  return operations;
}

interface Hunk {
  beforeStart: number;
  beforeCount: number;
  afterStart: number;
  afterCount: number;
  operations: Operation[];
}

function groupHunks(operations: Operation[]): Hunk[] {
  const changed: number[] = [];
  operations.forEach((operation, index) => {
    if (operation.kind !== "equal") changed.push(index);
  });
  const first = changed[0];
  if (first === undefined) return [];

  const ranges: Array<[number, number]> = [];
  let start = Math.max(0, first - CONTEXT_LINES);
  let end = Math.min(operations.length - 1, first + CONTEXT_LINES);
  for (const index of changed.slice(1)) {
    if (index - CONTEXT_LINES <= end + 1) {
      end = Math.min(operations.length - 1, index + CONTEXT_LINES);
      continue;
    }
    ranges.push([start, end]);
    start = Math.max(0, index - CONTEXT_LINES);
    end = Math.min(operations.length - 1, index + CONTEXT_LINES);
  }
  ranges.push([start, end]);

  const hunks: Hunk[] = [];
  let beforeLine = 1;
  let afterLine = 1;
  let cursor = 0;
  const advance = (index: number) => {
    const operation = operations[index];
    if (!operation) return;
    if (operation.kind !== "add") beforeLine += 1;
    if (operation.kind !== "remove") afterLine += 1;
  };

  for (const [from, to] of ranges) {
    while (cursor < from) {
      advance(cursor);
      cursor += 1;
    }
    const slice = operations.slice(from, to + 1);
    const beforeCount = slice.filter(
      (operation) => operation.kind !== "add",
    ).length;
    const afterCount = slice.filter(
      (operation) => operation.kind !== "remove",
    ).length;
    hunks.push({
      beforeStart: beforeCount ? beforeLine : beforeLine - 1,
      beforeCount,
      afterStart: afterCount ? afterLine : afterLine - 1,
      afterCount,
      operations: slice,
    });
    while (cursor <= to) {
      advance(cursor);
      cursor += 1;
    }
  }
  return hunks;
}

interface ParsedHunk {
  beforeStart: number;
  lines: string[];
}

export function applyUnifiedDiff(source: string, patch: string): string {
  const hunks = parseHunks(patch);
  if (!hunks.length) throw new Error("В патче не найдено ни одного ханка");
  const lines = splitLines(source);
  let offset = 0;

  for (const hunk of hunks) {
    const expected = hunk.lines
      .filter((line) => line.startsWith(" ") || line.startsWith("-"))
      .map((line) => line.slice(1));
    const replacement = hunk.lines
      .filter((line) => line.startsWith(" ") || line.startsWith("+"))
      .map((line) => line.slice(1));

    const hint = Math.max(0, hunk.beforeStart - 1 + offset);
    const at = locate(lines, expected, hint);
    if (at < 0)
      throw new Error(
        `Ханк @@ -${hunk.beforeStart} @@ не совпал с содержимым файла. Перечитайте файл и постройте патч заново.`,
      );
    lines.splice(at, expected.length, ...replacement);
    offset += replacement.length - expected.length;
  }

  return lines.join("\n");
}

function parseHunks(patch: string): ParsedHunk[] {
  const hunks: ParsedHunk[] = [];
  let current: ParsedHunk | undefined;
  const body = splitLines(patch);
  while (body.length && body[body.length - 1] === "") body.pop();
  for (const line of body) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      current = { beforeStart: Number(header[1]), lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    if (line.startsWith("\\")) continue;
    if (
      line.startsWith(" ") ||
      line.startsWith("+") ||
      line.startsWith("-") ||
      line === ""
    )
      current.lines.push(line === "" ? " " : line);
  }
  return hunks;
}

function locate(lines: string[], expected: string[], hint: number): number {
  if (!expected.length) return Math.min(hint, lines.length);
  if (matches(lines, expected, hint)) return hint;
  for (let delta = 1; delta <= APPLY_FUZZ_LINES; delta += 1) {
    if (matches(lines, expected, hint - delta)) return hint - delta;
    if (matches(lines, expected, hint + delta)) return hint + delta;
  }
  return -1;
}

function matches(lines: string[], expected: string[], at: number): boolean {
  if (at < 0 || at + expected.length > lines.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (lines[at + index] !== expected[index]) return false;
  }
  return true;
}
