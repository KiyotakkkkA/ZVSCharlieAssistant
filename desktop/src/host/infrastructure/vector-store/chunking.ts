import { estimateTextTokens } from "../../application/context/token-estimator";

export interface PageSegment {
  text: string;
  pageNumber: number | null;
}

export interface DocumentChunk {
  text: string;
  pageNumber: number | null;
  headingPath: string;
}

interface PageAnchor {
  offset: number;
  pageNumber: number | null;
}

interface TextUnit {
  offset: number;
  end: number;
  tokens: number;
}

interface Heading {
  offset: number;
  depth: number;
  text: string;
}

const PAGE_SEPARATOR = "\n\n";
const MIN_CHUNK_TOKENS = 12;
const MAX_HEADING_CHARS = 120;
const MIN_HEADING_LETTERS = 3;
const UPPERCASE_RATIO = 0.6;
const BREADCRUMB_SEPARATOR = " › ";
const TOP_LEVEL_HEADINGS =
  /^(раздел|глава|приложение|часть|параграф)(?![а-яё])/i;
const ARTICLE_HEADINGS = /^статья(?![а-яё])/i;
const CLAUSE_HEADINGS = /^п\.\s*(\d+(?:\.\d+)*)/i;
const NUMBERED_HEADINGS = /^(\d+(?:\.\d+)*)\.?(?:\s|$)/;
const SENTENCE_TERMINATORS = new Set([".", "!", "?", "…"]);
const CLOSING_MARKS = new Set(['"', "»", "'", ")", "]", "”", "„"]);

export function chunkDocument(
  segments: PageSegment[],
  sizeTokens: number,
  overlapTokens: number,
  fileName = "",
): DocumentChunk[] {
  const { text, anchors } = joinPages(segments);
  const blocks = splitBlocks(text);
  const headings = collectHeadings(text, blocks);
  const headingAt = new Map(
    headings.map((heading) => [heading.offset, heading] as const),
  );
  const units = splitUnits(text, blocks, sizeTokens);
  if (!units.length) return [];
  absorbGaps(text, units);

  const overlapBudget = Math.min(overlapTokens, Math.floor(sizeTokens / 2));
  const maxPrefixTokens = Math.max(1, Math.floor(sizeTokens / 3));
  const chunks: DocumentChunk[] = [];

  let start = 0;
  while (start < units.length) {
    const first = units[start]!;
    const pageNumber = pageAt(anchors, first.offset);
    const stack = headingStackBefore(headings, first.offset);
    for (let scan = start; scan < units.length; scan += 1) {
      const heading = headingAt.get(units[scan]!.offset);
      if (!heading) break;
      applyHeading(stack, heading);
    }
    const headingPath = stack
      .map((heading) => heading.text)
      .join(BREADCRUMB_SEPARATOR);
    const prefix = breadcrumb(
      fileName,
      headingPath,
      pageNumber,
      maxPrefixTokens,
    );
    const budget =
      sizeTokens - estimateTextTokens(prefix ? `${prefix}\n\n` : "");

    fitUnit(text, units, start, budget);

    let end = start;
    let tokens = 0;
    while (end < units.length) {
      const unit = units[end]!;
      if (end > start && tokens + unit.tokens > budget) break;
      tokens += unit.tokens;
      end += 1;
    }

    const last = units[end - 1]!;
    const body = text.slice(first.offset, last.end).trim();
    if (estimateTextTokens(body) >= MIN_CHUNK_TOKENS)
      chunks.push({
        text: prefix ? `${prefix}\n\n${body}` : body,
        pageNumber,
        headingPath,
      });

    if (end >= units.length) break;

    let back = end;
    let carried = 0;
    while (
      back > start + 1 &&
      carried + units[back - 1]!.tokens <= overlapBudget
    ) {
      carried += units[back - 1]!.tokens;
      back -= 1;
    }
    start = back;
  }

  return chunks;
}

function fitUnit(
  text: string,
  units: TextUnit[],
  index: number,
  budget: number,
): void {
  const unit = units[index]!;
  if (unit.tokens <= budget) return;
  let cursor = unit.offset;
  let cut = -1;
  while (cursor < unit.end) {
    while (cursor < unit.end && /\s/.test(text[cursor]!)) cursor += 1;
    const wordStart = cursor;
    while (cursor < unit.end && !/\s/.test(text[cursor]!)) cursor += 1;
    if (cursor === wordStart) break;
    if (estimateTextTokens(text.slice(unit.offset, cursor)) > budget) break;
    cut = cursor;
  }
  if (cut <= unit.offset || cut >= unit.end) return;
  units.splice(
    index,
    1,
    {
      offset: unit.offset,
      end: cut,
      tokens: estimateTextTokens(text.slice(unit.offset, cut)),
    },
    {
      offset: cut,
      end: unit.end,
      tokens: estimateTextTokens(text.slice(cut, unit.end)),
    },
  );
}

function absorbGaps(text: string, units: TextUnit[]): void {
  for (let index = 0; index < units.length - 1; index += 1) {
    const unit = units[index]!;
    unit.end = units[index + 1]!.offset;
    unit.tokens = estimateTextTokens(text.slice(unit.offset, unit.end));
  }
}

function breadcrumb(
  fileName: string,
  headingPath: string,
  pageNumber: number | null,
  maxTokens: number,
): string {
  const page = pageNumber === null ? "" : `стр. ${pageNumber}`;
  let name = fileName;
  let segments = headingPath ? headingPath.split(BREADCRUMB_SEPARATOR) : [];
  const build = () =>
    [name, segments.join(BREADCRUMB_SEPARATOR), page]
      .filter(Boolean)
      .join(BREADCRUMB_SEPARATOR);

  let result = build();
  while (segments.length && estimateTextTokens(result) > maxTokens) {
    segments = segments.slice(1);
    result = build();
  }
  while (name.length > 1 && estimateTextTokens(result) > maxTokens) {
    name = `${name.slice(0, Math.floor(name.length / 2))}…`;
    result = build();
  }
  if (estimateTextTokens(result) > maxTokens) {
    name = "";
    result = build();
  }
  return result;
}

function collectHeadings(
  text: string,
  blocks: Array<{ offset: number; end: number }>,
): Heading[] {
  const headings: Heading[] = [];
  for (const block of blocks) {
    const raw = text.slice(block.offset, block.end);
    if (raw.includes("\n")) continue;
    const detected = detectHeading(raw.trim());
    if (detected)
      headings.push({
        offset: block.offset,
        depth: detected.depth,
        text: detected.text,
      });
  }
  return headings;
}

export function detectHeading(
  line: string,
): { depth: number; text: string } | undefined {
  const text = line.trim();
  if (!text || text.length > MAX_HEADING_CHARS) return undefined;

  const clause = CLAUSE_HEADINGS.exec(text);
  if (clause) return { depth: 1 + clause[1]!.split(".").length, text };
  if (ARTICLE_HEADINGS.test(text)) return { depth: 2, text };
  if (TOP_LEVEL_HEADINGS.test(text)) return { depth: 1, text };

  const numbered = NUMBERED_HEADINGS.exec(text);
  if (numbered) return { depth: numbered[1]!.split(".").length, text };

  const letters = [...text].filter(
    (character) => character.toUpperCase() !== character.toLowerCase(),
  );
  if (letters.length < MIN_HEADING_LETTERS) return undefined;
  const upper = letters.filter(
    (character) => character === character.toUpperCase(),
  ).length;
  if (upper / letters.length >= UPPERCASE_RATIO) return { depth: 1, text };
  return undefined;
}

function headingStackBefore(headings: Heading[], offset: number): Heading[] {
  const stack: Heading[] = [];
  for (const heading of headings) {
    if (heading.offset >= offset) break;
    applyHeading(stack, heading);
  }
  return stack;
}

function applyHeading(stack: Heading[], heading: Heading): void {
  while (stack.length && stack[stack.length - 1]!.depth >= heading.depth)
    stack.pop();
  stack.push(heading);
}

function joinPages(segments: PageSegment[]): {
  text: string;
  anchors: PageAnchor[];
} {
  const anchors: PageAnchor[] = [];
  const parts: string[] = [];
  let offset = 0;
  for (const segment of segments) {
    const normalized = normalize(segment.text);
    if (!normalized) continue;
    if (parts.length) offset += PAGE_SEPARATOR.length;
    anchors.push({ offset, pageNumber: segment.pageNumber });
    parts.push(normalized);
    offset += normalized.length;
  }
  return { text: parts.join(PAGE_SEPARATOR), anchors };
}

function normalize(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function pageAt(anchors: PageAnchor[], offset: number): number | null {
  let found: PageAnchor | undefined;
  for (const anchor of anchors) {
    if (anchor.offset > offset) break;
    found = anchor;
  }
  return found?.pageNumber ?? null;
}

function splitUnits(
  text: string,
  blocks: Array<{ offset: number; end: number }>,
  sizeTokens: number,
): TextUnit[] {
  const units: TextUnit[] = [];
  for (const block of blocks)
    for (const sentence of splitSentences(text, block.offset, block.end))
      appendUnit(text, sentence.offset, sentence.end, sizeTokens, units);
  return units;
}

function splitBlocks(text: string): Array<{ offset: number; end: number }> {
  const blocks: Array<{ offset: number; end: number }> = [];
  const boundary = /\n[ \t]*\n[\s]*/g;
  let cursor = 0;
  for (let match = boundary.exec(text); match; match = boundary.exec(text)) {
    pushRange(text, cursor, match.index, blocks);
    cursor = match.index + match[0].length;
  }
  pushRange(text, cursor, text.length, blocks);
  return blocks;
}

function splitSentences(
  text: string,
  from: number,
  to: number,
): Array<{ offset: number; end: number }> {
  const sentences: Array<{ offset: number; end: number }> = [];
  let cursor = from;
  let index = from;
  while (index < to) {
    if (!SENTENCE_TERMINATORS.has(text[index]!)) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (
      end < to &&
      (SENTENCE_TERMINATORS.has(text[end]!) || CLOSING_MARKS.has(text[end]!))
    )
      end += 1;
    let next = end;
    while (next < to && /\s/.test(text[next]!)) next += 1;
    if (next === end || (next < to && !startsSentence(text[next]!))) {
      index = end;
      continue;
    }
    pushRange(text, cursor, end, sentences);
    cursor = next;
    index = next;
  }
  pushRange(text, cursor, to, sentences);
  return sentences;
}

function startsSentence(character: string): boolean {
  return (
    character === character.toUpperCase() &&
    character !== character.toLowerCase()
  );
}

function appendUnit(
  text: string,
  from: number,
  to: number,
  sizeTokens: number,
  units: TextUnit[],
): void {
  const tokens = estimateTextTokens(text.slice(from, to));
  if (tokens <= sizeTokens) {
    units.push({ offset: from, end: to, tokens });
    return;
  }
  let cursor = from;
  let wordStart = from;
  let carried = 0;
  let index = from;
  while (index < to) {
    while (index < to && /\s/.test(text[index]!)) index += 1;
    wordStart = index;
    while (index < to && !/\s/.test(text[index]!)) index += 1;
    if (index === wordStart) break;
    const wordTokens = estimateTextTokens(text.slice(wordStart, index));
    if (wordStart > cursor && carried + wordTokens > sizeTokens) {
      units.push({ offset: cursor, end: wordStart, tokens: carried });
      cursor = wordStart;
      carried = 0;
    }
    carried += wordTokens;
  }
  if (cursor < to) units.push({ offset: cursor, end: to, tokens: carried });
}

function pushRange(
  text: string,
  from: number,
  to: number,
  target: Array<{ offset: number; end: number }>,
): void {
  let start = from;
  let end = to;
  while (start < end && /\s/.test(text[start]!)) start += 1;
  while (end > start && /\s/.test(text[end - 1]!)) end -= 1;
  if (start < end) target.push({ offset: start, end });
}
