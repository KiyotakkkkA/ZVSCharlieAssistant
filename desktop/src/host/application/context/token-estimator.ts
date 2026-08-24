import type { ChatMessageContentPart } from "../../../shared/dto";

const LATIN_CHARS_PER_TOKEN = 3.6;
const WIDE_CHARS_PER_TOKEN = 2.0;
const SAFETY_FACTOR = 1.08;

export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  let wide = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) > 0x24f) wide += 1;
  }
  const latin = text.length - wide;
  const raw = latin / LATIN_CHARS_PER_TOKEN + wide / WIDE_CHARS_PER_TOKEN;
  return Math.ceil(raw * SAFETY_FACTOR);
}

export function estimateJsonTokens(value: unknown): number {
  if (value === undefined || value === null) return 1;
  try {
    return estimateTextTokens(JSON.stringify(value) ?? "");
  } catch {
    return estimateTextTokens(String(value));
  }
}

const MESSAGE_OVERHEAD_TOKENS = 4;
const TOOL_PART_OVERHEAD_TOKENS = 8;

export function estimatePartTokens(part: ChatMessageContentPart): number {
  switch (part.type) {
    case "text":
    case "reasoning":
    case "summary":
      return estimateTextTokens(part.text);
    case "tool-call":
      return (
        TOOL_PART_OVERHEAD_TOKENS +
        estimateTextTokens(part.toolName) +
        estimateJsonTokens(part.input)
      );
    case "tool-result":
      return (
        TOOL_PART_OVERHEAD_TOKENS +
        estimateTextTokens(part.toolName) +
        estimateJsonTokens(part.output)
      );
    default:
      return 0;
  }
}

export function estimatePartsTokens(parts: ChatMessageContentPart[]): number {
  return parts.reduce(
    (total, part) => total + estimatePartTokens(part),
    MESSAGE_OVERHEAD_TOKENS,
  );
}

export class TokenCounter {
  private readonly cache = new Map<string, { tokens: number; size: number }>();

  count(messageId: string, parts: ChatMessageContentPart[]): number {
    const size = parts.length;
    const cached = this.cache.get(messageId);
    if (cached && cached.size === size) return cached.tokens;
    const tokens = estimatePartsTokens(parts);
    this.cache.set(messageId, { tokens, size });
    return tokens;
  }

  invalidate(messageId: string) {
    this.cache.delete(messageId);
  }

  clear() {
    this.cache.clear();
  }
}
