import { describe, expect, it } from "vitest";
import { maximumScrollOffset } from "../../src/cli/tui/organisms/Transcript";

describe("viewport ленты TUI", () => {
  it("вычисляет диапазон прокрутки только для переполненной ленты", () => {
    expect(maximumScrollOffset(20, 30)).toBe(0);
    expect(maximumScrollOffset(30, 30)).toBe(0);
    expect(maximumScrollOffset(75, 30)).toBe(45);
  });
});
