export type MouseButton = "left" | "middle" | "right" | "none";

export interface TuiMouseEvent {
  kind: "press" | "release" | "drag" | "wheel";
  button: MouseButton;
  direction?: "up" | "down";
  x: number;
  y: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

export const MOUSE_ENABLE = "\u001B[?1000h\u001B[?1006h";

export const MOUSE_DISABLE = "\u001B[?1006l\u001B[?1000l";

const SEQUENCE_START = "\u001B[<";

const MAX_PENDING = 32;

export function parseMouseEvents(chunk: string): {
  events: TuiMouseEvent[];
  rest: string;
} {
  const events: TuiMouseEvent[] = [];
  let index = 0;
  for (;;) {
    const start = chunk.indexOf(SEQUENCE_START, index);
    if (start < 0) break;
    const parsed = parseOne(chunk, start);
    if (parsed === "pending") {
      const rest = chunk.slice(start);
      return { events, rest: rest.length > MAX_PENDING ? "" : rest };
    }
    if (parsed === undefined) {
      index = start + SEQUENCE_START.length;
      continue;
    }
    events.push(parsed.event);
    index = parsed.nextIndex;
  }
  return { events, rest: "" };
}

export function isMouseInput(input: string): boolean {
  return (
    /^(?:\u001B)?\[<\d*;?\d*;?\d*[Mm]?$/.test(input) && input.includes("<")
  );
}

function parseOne(
  chunk: string,
  start: number,
): { event: TuiMouseEvent; nextIndex: number } | "pending" | undefined {
  const end = findFinalByte(chunk, start + SEQUENCE_START.length);
  if (end === "pending") return "pending";
  if (end === undefined) return undefined;
  const body = chunk.slice(start + SEQUENCE_START.length, end);
  const final = chunk[end]!;
  const parts = body.split(";");
  if (parts.length !== 3) return undefined;
  const [rawCode, rawX, rawY] = parts.map((part) => Number.parseInt(part, 10));
  if (
    rawCode === undefined ||
    rawX === undefined ||
    rawY === undefined ||
    Number.isNaN(rawCode) ||
    Number.isNaN(rawX) ||
    Number.isNaN(rawY)
  )
    return undefined;

  const wheel = (rawCode & 64) !== 0;
  const motion = (rawCode & 32) !== 0;
  const buttonBits = rawCode & 3;
  return {
    event: {
      kind: wheel
        ? "wheel"
        : motion
          ? "drag"
          : final === "m"
            ? "release"
            : "press",
      button: wheel ? "none" : BUTTONS[buttonBits]!,
      direction: wheel ? (buttonBits === 0 ? "up" : "down") : undefined,
      x: Math.max(0, rawX - 1),
      y: Math.max(0, rawY - 1),
      shift: (rawCode & 4) !== 0,
      alt: (rawCode & 8) !== 0,
      ctrl: (rawCode & 16) !== 0,
    },
    nextIndex: end + 1,
  };
}

const BUTTONS: MouseButton[] = ["left", "middle", "right", "none"];

function findFinalByte(
  chunk: string,
  from: number,
): number | "pending" | undefined {
  for (let index = from; index < chunk.length; index += 1) {
    const character = chunk[index]!;
    if (character === "M" || character === "m") return index;
    if (!/[0-9;]/.test(character)) return undefined;
  }
  return "pending";
}
