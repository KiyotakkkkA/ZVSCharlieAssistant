import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { render, Text } from "ink";
import { EventEmitter } from "node:events";
import { useMouse } from "../../src/cli/tui/useMouse";
import {
  MOUSE_DISABLE,
  MOUSE_ENABLE,
  type TuiMouseEvent,
} from "../../src/cli/tui/mouse";

function fakeStreams() {
  const written: string[] = [];
  const stdout = Object.assign(new EventEmitter(), {
    write: (chunk: string) => {
      written.push(chunk);
      return true;
    },
    columns: 80,
    rows: 24,
    isTTY: true,
  });
  const stdin = Object.assign(new EventEmitter(), {
    isTTY: true,
    setRawMode: () => stdin,
    setEncoding: () => stdin,
    resume: () => stdin,
    pause: () => stdin,
    read: () => null,
    ref: () => stdin,
    unref: () => stdin,
  });
  return { stdout, stdin, written };
}

function Probe({ onEvent }: { onEvent: (event: TuiMouseEvent) => void }) {
  useMouse(onEvent);
  return createElement(Text, null, "probe");
}

describe("подписка на мышь в живом рендере", () => {
  it("включает репортинг, разбирает события из stdin и выключает при выходе", async () => {
    const { stdout, stdin, written } = fakeStreams();
    const events: TuiMouseEvent[] = [];
    const app = render(
      createElement(Probe, { onEvent: (event) => events.push(event) }),
      { stdout: stdout as never, stdin: stdin as never, patchConsole: false },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(written.some((chunk) => chunk === MOUSE_ENABLE)).toBe(true);

    // Событие приходит двумя чанками — склейка идёт через буфер хука.
    stdin.emit("data", "[<0;12");
    stdin.emit("data", ";7M");
    stdin.emit("data", "[<65;1;1M");

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: "press",
      button: "left",
      x: 11,
      y: 6,
    });
    expect(events[1]).toMatchObject({ kind: "wheel", direction: "down" });

    app.unmount();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      written.at(-1) === MOUSE_DISABLE || written.includes(MOUSE_DISABLE),
    ).toBe(true);
    expect(stdin.listenerCount("data")).toBe(0);
  });

  it("не трогает терминал, когда мышь выключена", async () => {
    const { stdout, stdin, written } = fakeStreams();
    function Disabled() {
      useMouse(vi.fn(), { isActive: false });
      return createElement(Text, null, "probe");
    }
    const app = render(createElement(Disabled), {
      stdout: stdout as never,
      stdin: stdin as never,
      patchConsole: false,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(written.some((chunk) => chunk.includes(MOUSE_ENABLE))).toBe(false);
    app.unmount();
  });
});
