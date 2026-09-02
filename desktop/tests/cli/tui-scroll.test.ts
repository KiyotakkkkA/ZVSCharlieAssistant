import { describe, expect, it } from "vitest";
import {
  maximumScrollOffset,
  scrollbarThumb,
} from "../../src/cli/tui/organisms/Transcript";

describe("viewport ленты TUI", () => {
  it("вычисляет диапазон прокрутки только для переполненной ленты", () => {
    expect(maximumScrollOffset(20, 30)).toBe(0);
    expect(maximumScrollOffset(30, 30)).toBe(0);
    expect(maximumScrollOffset(75, 30)).toBe(45);
  });
});

describe("ползунок полосы прокрутки", () => {
  it("не показывается, пока лента помещается в окно", () => {
    expect(scrollbarThumb(30, 20, 0)).toBeUndefined();
    expect(scrollbarThumb(30, 30, 0)).toBeUndefined();
  });

  it("занимает долю окна, пропорциональную видимой части ленты", () => {
    expect(scrollbarThumb(30, 60, 0)).toEqual({ start: 0, size: 15 });
  });

  it("доходит до низа, когда лента прокручена до конца", () => {
    const thumb = scrollbarThumb(30, 60, 30);
    expect(thumb).toEqual({ start: 15, size: 15 });
  });

  it("не даёт ползунку выродиться на очень длинной ленте", () => {
    const thumb = scrollbarThumb(10, 10_000, 0);
    expect(thumb?.size).toBe(1);
  });
});
