import { estimateTextTokens } from "../../application/context/token-estimator";

export interface PageSegment {
  text: string;
  pageNumber: number | null;
}

export interface DocumentChunk {
  text: string;
  pageNumber: number | null;
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

const PAGE_SEPARATOR = "\n\n";
const MIN_CHUNK_TOKENS = 12;
const SENTENCE_TERMINATORS = new Set([".", "!", "?", "…"]);
const CLOSING_MARKS = new Set(['"', "»", "'", ")", "]", "”", "„"]);

export function chunkDocument(
  segments: PageSegment[],
  sizeTokens: number,
  overlapTokens: number,
): DocumentChunk[] {
  const { text, anchors } = joinPages(segments);
  const units = splitUnits(text, sizeTokens);
  if (!units.length) return [];

  const overlapBudget = Math.min(overlapTokens, Math.floor(sizeTokens / 2));
  const chunks: DocumentChunk[] = [];

  let start = 0;
  while (start < units.length) {
    let end = start;
    let tokens = 0;
    while (end < units.length) {
      const unit = units[end]!;
      if (end > start && tokens + unit.tokens > sizeTokens) break;
      tokens += unit.tokens;
      end += 1;
    }

    const first = units[start]!;
    const last = units[end - 1]!;
    const body = text.slice(first.offset, last.end).trim();
    if (estimateTextTokens(body) >= MIN_CHUNK_TOKENS)
      chunks.push({ text: body, pageNumber: pageAt(anchors, first.offset) });

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

function splitUnits(text: string, sizeTokens: number): TextUnit[] {
  const units: TextUnit[] = [];
  for (const block of splitBlocks(text))
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
