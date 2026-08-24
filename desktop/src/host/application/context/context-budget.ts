export interface ContextBudget {
  contextLength: number;
  maxOutput: number;
  usable: number;
  compactAt: number;
  hardStop: number;
  estimated: boolean;
}

export const DEFAULT_CONTEXT_LENGTH = 32_768;

const RESERVE_RATIO = 0.12;
const MIN_RESERVE_TOKENS = 512;

export const DEFAULT_COMPACT_THRESHOLD = 0.78;

export function resolveContextBudget(input: {
  contextLength?: number | null;
  maxOutputTokens: number;
  compactThreshold?: number;
}): ContextBudget {
  const estimated = !input.contextLength || input.contextLength <= 0;
  const contextLength = estimated
    ? DEFAULT_CONTEXT_LENGTH
    : Number(input.contextLength);
  const maxOutput = Math.max(
    256,
    Math.min(input.maxOutputTokens, Math.floor(contextLength / 2)),
  );
  const reserve = Math.max(
    MIN_RESERVE_TOKENS,
    Math.floor(contextLength * RESERVE_RATIO),
  );
  const usable = Math.max(1_024, contextLength - maxOutput - reserve);
  const threshold = clamp(
    input.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD,
    0.4,
    0.95,
  );
  return {
    contextLength,
    maxOutput,
    usable,
    compactAt: Math.floor(usable * threshold),
    hardStop: Math.floor(usable * 0.95),
    estimated,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
