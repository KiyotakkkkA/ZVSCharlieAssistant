export function errorMessage(text: string, hint?: string) {
  process.stderr.write(`Ошибка: ${text}${hint ? `\n${hint}` : ""}\n`);
}

export function resumeHint(conversationId: string) {
  process.stdout.write(
    [
      "",
      "Диалог сохранён. Продолжить с этого же места:",
      `  zvs --resume ${conversationId}`,
      "",
    ].join("\n"),
  );
}

export function helpScreen(
  usage: ReadonlyArray<readonly [string, string]>,
  options: ReadonlyArray<readonly [string, string]>,
) {
  process.stdout.write(
    [
      "ZVS Assistant",
      "",
      "Использование:",
      ...formatRows(usage),
      "",
      "Параметры:",
      ...formatRows(options),
      "",
      "Интерактивно: Tab — дополнить · ↑↓ — история · колесо и клик мышью · Ctrl+C — отмена / выход",
      "",
    ].join("\n"),
  );
}

export function compactValue(value: unknown, width = 96): string {
  if (value === undefined) return "";
  let rendered: string;
  try {
    rendered = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    rendered = String(value);
  }
  const singleLine = rendered.replace(/\s+/g, " ").trim();
  return singleLine.length <= width
    ? singleLine
    : `${singleLine.slice(0, Math.max(0, width - 1))}…`;
}

function formatRows(rows: ReadonlyArray<readonly [string, string]>): string[] {
  const width = rows.reduce((max, [left]) => Math.max(max, left.length), 0);
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`);
}
