import { emitKeypressEvents, type Key } from "node:readline";
import {
  ANSI,
  palette,
  style,
  symbols,
  truncateVisible,
  visibleLength,
} from "./theme";

export const ZVS_LOGO = [
  "███████╗██╗   ██╗███████╗",
  "╚══███╔╝██║   ██║██╔════╝",
  "  ███╔╝ ██║   ██║███████╗",
  " ███╔╝  ╚██╗ ██╔╝╚════██║",
  "███████╗ ╚████╔╝ ███████║",
  "╚══════╝  ╚═══╝  ╚══════╝",
] as const;

export function write(text: string) {
  process.stdout.write(text);
}

export function line(text = "") {
  process.stdout.write(`${text}\n`);
}

export function note(text: string) {
  process.stderr.write(`${palette.faint(text)}\n`);
}

export function errorMessage(text: string, hint?: string) {
  process.stderr.write(
    `${palette.danger(symbols.fail)} ${style.bold(palette.danger(text))}${hint ? `\n  ${palette.faint(hint)}` : ""}\n`,
  );
}

export function terminalWidth(): number {
  return Math.min(Math.max(process.stdout.columns ?? 80, 48), 110);
}

export function box(rows: string[], title?: string): string {
  const width = terminalWidth();
  const inner = width - 4;
  const top = title
    ? `╭─ ${palette.accentStrong(title)} ${"─".repeat(Math.max(0, width - visibleLength(title) - 5))}╮`
    : `╭${"─".repeat(width - 2)}╮`;
  const body = rows.map((row) => {
    const fitted = truncateVisible(row, inner);
    const padding = Math.max(0, inner - visibleLength(fitted));
    return `${palette.accentDim("│")} ${fitted}${" ".repeat(padding)} ${palette.accentDim("│")}`;
  });
  return [
    title ? top : palette.accentDim(top),
    ...body,
    palette.accentDim(`╰${"─".repeat(width - 2)}╯`),
  ].join("\n");
}

function paintLogo(line: string, index: number): string {
  const paints = [
    palette.accent,
    palette.accentStrong,
    palette.accentStrong,
    palette.accentDim,
    palette.cyan,
    palette.violet,
  ];
  return (paints[index] ?? palette.accent)(line);
}

export function wordmark(compact = false): string[] {
  if (compact)
    return [
      `${style.bold(palette.accentStrong("ZVS"))} ${style.bold(palette.text("Assistant"))}`,
    ];
  return ZVS_LOGO.map(paintLogo);
}

export function banner(info: {
  version: string;
  model: string;
  project: string;
  permission: string;
}) {
  line();
  const logo = wordmark();
  const details = [
    `${style.bold(palette.text("ZVS Assistant"))} ${palette.faint(`v${info.version}`)}`,
    "",
    `${palette.faint("модель")}   ${palette.text(info.model)}`,
    `${palette.faint("проект")}   ${palette.text(info.project)}`,
    `${palette.faint("доступ")}   ${permissionTone(info.permission)}`,
  ];
  const sideBySide = terminalWidth() >= 78;
  const rows = sideBySide
    ? logo.map(
        (logoRow, index) =>
          `${logoRow}${" ".repeat(Math.max(2, 31 - visibleLength(logoRow)))}${details[index] ?? ""}`,
      )
    : [...logo, "", ...details];
  line(box(rows));
  line(
    `  ${palette.accentStrong(symbols.user)} ${palette.faint("Введите задачу или /help для списка команд")}`,
  );
  line();
}

function permissionTone(permission: string): string {
  if (permission.startsWith("deny")) return palette.danger(permission);
  if (permission.startsWith("plan")) return palette.info(permission);
  return palette.success(permission);
}

export function helpScreen(
  usage: ReadonlyArray<readonly [string, string]>,
  options: ReadonlyArray<readonly [string, string]>,
) {
  line();
  for (const logoLine of wordmark()) line(`  ${logoLine}`);
  line();
  line(
    `  ${style.bold(palette.text("ZVS Assistant"))} ${palette.faint("· интерактивная командная оболочка")}`,
  );
  line();
  heading("Использование");
  table([...usage]);
  line();
  heading("Параметры");
  table([...options]);
  line();
  line(
    `  ${palette.accentStrong("Интерактивно")}  ${palette.faint("Tab — команды · ↑↓ — история · Ctrl+C — отмена задачи / выход · /help — помощь")}`,
  );
  line(
    `  ${palette.faint("Коды возврата: 0 успех · 1 ошибка · 2 запрещено · 3 приложение недоступно")}`,
  );
  line();
}

export function statusLine(parts: Array<[string, string]>) {
  const rendered = parts
    .map(([label, value]) => `${palette.faint(label)} ${palette.muted(value)}`)
    .join(palette.faint(`  ${symbols.bullet}  `));
  process.stderr.write(
    `${palette.accentDim("──")} ${rendered} ${palette.accentDim("──")}\n`,
  );
}

export function heading(text: string) {
  line(
    `${palette.accentStrong(symbols.cursor)} ${style.bold(palette.text(text))}`,
  );
}

export function assistantHeading() {
  line(
    `${palette.accentStrong(symbols.assistant)} ${style.bold(palette.text("ZVS"))}`,
  );
}

export function reasoningHeading() {
  line(
    `${palette.violet(symbols.cursor)} ${style.bold(palette.muted("Размышления"))}`,
  );
}

export function compactValue(value: unknown, width = terminalWidth() - 12): string {
  if (value === undefined) return "";
  let rendered: string;
  try {
    rendered = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    rendered = String(value);
  }
  return truncateVisible(rendered.replace(/\s+/g, " ").trim(), width);
}

export function promptText(): string {
  return `${style.bold(palette.accentStrong(symbols.user))} `;
}

export function divider() {
  line(palette.faint("─".repeat(terminalWidth())));
}

export function progressBar(percent: number, width = 12): string {
  const normalized = Math.min(100, Math.max(0, Math.round(percent)));
  const filled = Math.round((normalized / 100) * width);
  return `${palette.accentStrong("━".repeat(filled))}${palette.faint("━".repeat(width - filled))} ${normalized}%`;
}

export function bullet(
  text: string,
  tone: "muted" | "danger" | "success" = "muted",
) {
  const paint =
    tone === "danger"
      ? palette.danger
      : tone === "success"
        ? palette.success
        : palette.muted;
  process.stderr.write(`  ${palette.faint(symbols.bullet)} ${paint(text)}\n`);
}

export function table(rows: ReadonlyArray<readonly [string, string]>) {
  const width = rows.reduce(
    (max, [left]) => Math.max(max, visibleLength(left)),
    0,
  );
  for (const [left, right] of rows)
    line(
      `  ${palette.accent(left.padEnd(width))}  ${palette.faint(symbols.bullet)}  ${palette.text(right)}`,
    );
}

export class Spinner {
  private timer?: NodeJS.Timeout;
  private frame = 0;
  private active = false;

  constructor(private readonly label: string) {}

  start() {
    if (!process.stderr.isTTY || this.active) return;
    this.active = true;
    process.stderr.write(ANSI.hideCursor);
    this.timer = setInterval(() => {
      const glyph = symbols.spinner[this.frame % symbols.spinner.length] ?? "";
      this.frame += 1;
      process.stderr.write(
        `${ANSI.clearLine}${palette.accentStrong(glyph)} ${palette.faint(this.label)}`,
      );
    }, 90);
    this.timer.unref();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    process.stderr.write(`${ANSI.clearLine}${ANSI.showCursor}`);
  }
}

export interface SelectItem<T> {
  label: string;
  hint?: string;
  value: T;
}

export async function select<T>(
  title: string,
  items: Array<SelectItem<T>>,
  initial = 0,
): Promise<T | undefined> {
  if (!items.length) return undefined;
  if (!process.stdin.isTTY) return items[initial]?.value;

  let index = Math.min(Math.max(initial, 0), items.length - 1);
  const pageSize = Math.min(
    items.length,
    Math.max(4, Math.min(9, (process.stdout.rows ?? 16) - 6)),
  );
  const renderedLines = pageSize + 2;
  const render = (first: boolean) => {
    if (!first) write(ANSI.up(renderedLines));
    const start = Math.min(
      Math.max(0, index - Math.floor(pageSize / 2)),
      Math.max(0, items.length - pageSize),
    );
    const visible = items.slice(start, start + pageSize);
    write(
      `${ANSI.clearLine}${style.bold(palette.text(title))} ${palette.faint("· ↑↓ выбрать · Enter подтвердить · Esc назад")}\n`,
    );
    visible.forEach((item, offset) => {
      const position = start + offset;
      const active = position === index;
      const marker = active
        ? palette.accentStrong(symbols.selected)
        : palette.faint(symbols.unselected);
      const label = active
        ? style.bold(palette.text(item.label))
        : palette.muted(item.label);
      const hint = item.hint ? palette.faint(`  ${item.hint}`) : "";
      write(`${ANSI.clearLine}${marker} ${label}${hint}\n`);
    });
    write(
      `${ANSI.clearLine}${palette.faint(`${index + 1} / ${items.length}`)}\n`,
    );
  };

  emitKeypressEvents(process.stdin);
  const suspendedKeypressListeners = process.stdin.listeners(
    "keypress",
  ) as Array<(sequence: string, key: Key) => void>;
  process.stdin.removeAllListeners("keypress");
  const wasRaw = process.stdin.isRaw ?? false;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  write(ANSI.hideCursor);
  render(true);

  return new Promise<T | undefined>((resolve) => {
    const clearMenu = () => {
      write(ANSI.up(renderedLines));
      for (let row = 0; row < renderedLines; row += 1) {
        write(ANSI.clearLine);
        if (row < renderedLines - 1) write("\n");
      }
      if (renderedLines > 1) write(ANSI.up(renderedLines - 1));
    };
    const finish = (value: T | undefined) => {
      process.stdin.off("keypress", onKey);
      for (const listener of suspendedKeypressListeners)
        process.stdin.on("keypress", listener);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      clearMenu();
      write(ANSI.showCursor);
      resolve(value);
    };
    const onKey = (_chunk: string, key: Key | undefined) => {
      if (!key) return;
      if (key.name === "up" || key.name === "k") {
        index = (index - 1 + items.length) % items.length;
        render(false);
        return;
      }
      if (key.name === "down" || key.name === "j") {
        index = (index + 1) % items.length;
        render(false);
        return;
      }
      if (key.name === "return") {
        finish(items[index]?.value);
        return;
      }
      if (key.name === "home") {
        index = 0;
        render(false);
        return;
      }
      if (key.name === "end") {
        index = items.length - 1;
        render(false);
        return;
      }
      if (key.name === "escape")
        finish(undefined);
      else if (key.ctrl && key.name === "c") {
        finish(undefined);
        process.nextTick(() => process.emit("SIGINT"));
      }
    };
    process.stdin.on("keypress", onKey);
  });
}

export function captureRunCancellation(onCancel: () => void): () => void {
  if (!process.stdin.isTTY) return () => undefined;

  emitKeypressEvents(process.stdin);
  const suspendedKeypressListeners = process.stdin.listeners(
    "keypress",
  ) as Array<(sequence: string, key: Key) => void>;
  process.stdin.removeAllListeners("keypress");
  const wasRaw = process.stdin.isRaw ?? false;
  process.stdin.setRawMode(true);
  process.stdin.resume();

  const onKey = (_chunk: string, key: Key | undefined) => {
    if (key?.ctrl && key.name === "c") onCancel();
  };
  process.stdin.on("keypress", onKey);

  return () => {
    process.stdin.off("keypress", onKey);
    for (const listener of suspendedKeypressListeners)
      process.stdin.on("keypress", listener);
    process.stdin.setRawMode(wasRaw);
    process.stdin.pause();
  };
}
