export interface DraftRow {
  text: string;
  start: number;
}

export interface DraftEdit {
  value: string;
  cursor: number;
}

const WORD = /[\p{L}\p{N}_]/u;

export function wrapDraft(value: string, width: number): DraftRow[] {
  const limit = Math.max(1, Math.floor(width));
  const rows: DraftRow[] = [];
  let offset = 0;
  for (const line of value.split("\n")) {
    const wrapped = wrapLine(line, limit);
    for (const chunk of wrapped) {
      rows.push({ text: chunk.text, start: offset + chunk.start });
    }
    offset += line.length + 1;
  }
  return rows.length ? rows : [{ text: "", start: 0 }];
}

function wrapLine(line: string, width: number): DraftRow[] {
  if (line.length <= width) return [{ text: line, start: 0 }];
  const rows: DraftRow[] = [];
  let start = 0;
  while (start < line.length) {
    const remaining = line.length - start;
    if (remaining <= width) {
      rows.push({ text: line.slice(start), start });
      break;
    }
    const window = line.slice(start, start + width + 1);
    const breakAt = window.lastIndexOf(" ");
    const take = breakAt > 0 ? breakAt : width;
    rows.push({ text: line.slice(start, start + take), start });
    start += breakAt > 0 ? take + 1 : take;
  }
  return rows;
}

export function offsetFromPoint(
  rows: DraftRow[],
  row: number,
  column: number,
): number {
  const clampedRow = Math.min(Math.max(0, row), rows.length - 1);
  const target = rows[clampedRow]!;
  return target.start + Math.min(Math.max(0, column), target.text.length);
}

export function pointFromOffset(
  rows: DraftRow[],
  cursor: number,
): { row: number; column: number } {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    if (cursor >= row.start)
      return {
        row: index,
        column: Math.min(cursor - row.start, row.text.length),
      };
  }
  return { row: 0, column: 0 };
}

export function previousWordBoundary(value: string, cursor: number): number {
  let index = Math.min(cursor, value.length);
  while (index > 0 && !WORD.test(value[index - 1]!)) index -= 1;
  while (index > 0 && WORD.test(value[index - 1]!)) index -= 1;
  return index;
}

export function nextWordBoundary(value: string, cursor: number): number {
  let index = Math.max(0, cursor);
  while (index < value.length && !WORD.test(value[index]!)) index += 1;
  while (index < value.length && WORD.test(value[index]!)) index += 1;
  return index;
}

export function deleteWordBefore(value: string, cursor: number): DraftEdit {
  const start = previousWordBoundary(value, cursor);
  return { value: value.slice(0, start) + value.slice(cursor), cursor: start };
}

export function deleteWordAfter(value: string, cursor: number): DraftEdit {
  const end = nextWordBoundary(value, cursor);
  return { value: value.slice(0, cursor) + value.slice(end), cursor };
}

export function deleteToLineStart(value: string, cursor: number): DraftEdit {
  const start = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
  return { value: value.slice(0, start) + value.slice(cursor), cursor: start };
}

export function deleteToLineEnd(value: string, cursor: number): DraftEdit {
  const lineEnd = value.indexOf("\n", cursor);
  const end = lineEnd < 0 ? value.length : lineEnd;
  return { value: value.slice(0, cursor) + value.slice(end), cursor };
}
