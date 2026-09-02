import { describe, expect, it } from "vitest";
import { isMouseInput, parseMouseEvents } from "../../src/cli/tui/mouse";

describe("разбор событий мыши", () => {
  it("читает нажатие и отпускание левой кнопки в 0-based координатах", () => {
    const { events, rest } = parseMouseEvents("[<0;10;5M[<0;10;5m");
    expect(rest).toBe("");
    expect(events).toEqual([
      {
        kind: "press",
        button: "left",
        direction: undefined,
        x: 9,
        y: 4,
        shift: false,
        alt: false,
        ctrl: false,
      },
      {
        kind: "release",
        button: "left",
        direction: undefined,
        x: 9,
        y: 4,
        shift: false,
        alt: false,
        ctrl: false,
      },
    ]);
  });

  it("различает колесо вверх и вниз", () => {
    const { events } = parseMouseEvents("[<64;1;1M[<65;1;1M");
    expect(events.map((event) => [event.kind, event.direction])).toEqual([
      ["wheel", "up"],
      ["wheel", "down"],
    ]);
  });

  it("распознаёт правую кнопку, перетаскивание и модификаторы", () => {
    const { events } = parseMouseEvents("[<2;3;4M[<52;3;4M");
    expect(events[0]).toMatchObject({ kind: "press", button: "right" });
    expect(events[1]).toMatchObject({ kind: "drag", shift: true });
  });

  it("придерживает незавершённую последовательность до следующего чанка", () => {
    const first = parseMouseEvents("[<0;12");
    expect(first.events).toHaveLength(0);
    expect(first.rest).toBe("[<0;12");
    const second = parseMouseEvents(`${first.rest};7M`);
    expect(second.events[0]).toMatchObject({ x: 11, y: 6, kind: "press" });
    expect(second.rest).toBe("");
  });

  it("пропускает мусор и не зависает на нём", () => {
    const { events, rest } = parseMouseEvents("abc[<zz[<0;2;2M");
    expect(events).toHaveLength(1);
    expect(rest).toBe("");
  });

  it("узнаёт последовательность мыши, дошедшую до обработчика клавиш", () => {
    expect(isMouseInput("[<0;10;5M")).toBe(true);
    expect(isMouseInput("[<65;1;1M")).toBe(true);
    expect(isMouseInput("привет")).toBe(false);
    expect(isMouseInput("[A")).toBe(false);
  });
});
