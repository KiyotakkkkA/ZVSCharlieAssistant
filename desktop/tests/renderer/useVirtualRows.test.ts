import { describe, expect, it } from "vitest";
import { virtualWindow } from "../../src/renderer/hooks/useVirtualRows";

const ROW = 80;

function windowFor(count: number, offset: number, height = 640) {
  return virtualWindow({ count, rowHeight: ROW, offset, height, overscan: 6 });
}

describe("virtualWindow", () => {
  it("renders a bounded slice instead of every document", () => {
    const view = windowFor(3000, 0);

    expect(view.start).toBe(0);
    expect(view.end - view.start).toBeLessThan(30);
    expect(view.paddingBottom).toBe((3000 - view.end) * ROW);
  });

  it("keeps total height stable while scrolling", () => {
    for (const offset of [0, 4000, 120_000, 239_920]) {
      const view = windowFor(3000, offset);
      const rendered = (view.end - view.start) * ROW;
      expect(view.paddingTop + rendered + view.paddingBottom).toBe(3000 * ROW);
    }
  });

  it("keeps rows above and below the viewport for smooth scrolling", () => {
    const view = windowFor(3000, 100 * ROW);

    expect(view.start).toBe(94);
    expect(view.end).toBeGreaterThan(100 + 8);
  });

  it("never runs past the end of the list", () => {
    const view = windowFor(10, 100 * ROW);

    expect(view.end).toBe(10);
    expect(view.paddingBottom).toBe(0);
  });

  it("renders everything before the container has been measured", () => {
    const view = virtualWindow({
      count: 12,
      rowHeight: ROW,
      offset: 0,
      height: 0,
      overscan: 6,
    });

    expect(view.start).toBe(0);
    expect(view.end).toBe(12);
  });
});
