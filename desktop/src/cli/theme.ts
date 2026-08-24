const forced = process.env.FORCE_COLOR;
const disabled =
  process.env.NO_COLOR !== undefined ||
  process.env.TERM === "dumb" ||
  forced === "0";

export const colorEnabled = disabled
  ? false
  : forced !== undefined || Boolean(process.stdout.isTTY || process.stderr.isTTY);

type Paint = (text: string) => string;

function rgb(red: number, green: number, blue: number): Paint {
  return (text) =>
    colorEnabled ? `\u001B[38;2;${red};${green};${blue}m${text}\u001B[39m` : text;
}

function bgRgb(red: number, green: number, blue: number): Paint {
  return (text) =>
    colorEnabled
      ? `\u001B[48;2;${red};${green};${blue}m${text}\u001B[49m`
      : text;
}

function code(open: number, close: number): Paint {
  return (text) =>
    colorEnabled ? `\u001B[${open}m${text}\u001B[${close}m` : text;
}

export const palette = {
  accent: rgb(216, 255, 141),
  accentStrong: rgb(183, 243, 74),
  accentDim: rgb(143, 197, 43),
  text: rgb(229, 229, 229),
  muted: rgb(163, 163, 163),
  faint: rgb(115, 115, 115),
  danger: rgb(239, 68, 68),
  warning: rgb(245, 158, 11),
  success: rgb(34, 197, 94),
  info: rgb(147, 197, 253),
  violet: rgb(196, 181, 253),
  cyan: rgb(103, 232, 249),
  surface: bgRgb(38, 38, 38),
};

export const style = {
  bold: code(1, 22),
  dim: code(2, 22),
  italic: code(3, 23),
  underline: code(4, 24),
  inverse: code(7, 27),
};

export const symbols = {
  mark: "⟨Z⟩",
  prompt: "›",
  assistant: "◆",
  user: "❯",
  bullet: "·",
  tool: "⟐",
  edit: "±",
  switched: "⇄",
  compacted: "⤵",
  ok: "✓",
  fail: "✗",
  arrow: "→",
  cursor: "▸",
  selected: "●",
  unselected: "○",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
};

export const ANSI = {
  reset: "\u001B[0m",
  clearScreen: "\u001B[2J\u001B[H",
  clearLine: "\u001B[2K\r",
  hideCursor: "\u001B[?25l",
  showCursor: "\u001B[?25h",
  up: (count: number) => `\u001B[${count}A`,
};

const ANSI_PATTERN = /\u001B\[[0-9;?]*[A-Za-z]/g;

export function visibleLength(text: string): number {
  return [...text.replace(ANSI_PATTERN, "")].length;
}

export function truncateVisible(text: string, width: number): string {
  if (width <= 0) return "";
  if (visibleLength(text) <= width) return text;

  let result = "";
  let visible = 0;
  let index = 0;
  while (index < text.length && visible < width - 1) {
    const rest = text.slice(index);
    const ansi = rest.match(/^\u001B\[[0-9;?]*[A-Za-z]/)?.[0];
    if (ansi) {
      result += ansi;
      index += ansi.length;
      continue;
    }
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    result += character;
    index += character.length;
    visible += 1;
  }
  return `${result}…${ANSI.reset}`;
}
