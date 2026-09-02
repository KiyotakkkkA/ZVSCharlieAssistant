export function visibleWindow(
  selected: number,
  total: number,
  maxItems: number,
): { start: number; count: number } {
  const count = Math.max(1, Math.min(maxItems, total));
  const start = Math.max(0, Math.min(selected - count + 1, total - count));
  return { start, count };
}
