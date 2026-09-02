import { describe, expect, it } from "vitest";
import {
  absoluteRect,
  containsPoint,
  rowWithin,
  type LayoutNode,
} from "../../src/cli/tui/geometry";

function node(
  layout: { left: number; top: number; width: number; height: number },
  parent?: LayoutNode,
): LayoutNode {
  return {
    yogaNode: { getComputedLayout: () => layout },
    parentNode: parent,
  };
}

describe("координаты элементов для попаданий мыши", () => {
  it("складывает смещения по цепочке родителей", () => {
    const root = node({ left: 0, top: 0, width: 80, height: 24 });
    const panel = node({ left: 0, top: 18, width: 80, height: 6 }, root);
    const list = node({ left: 1, top: 2, width: 78, height: 3 }, panel);
    expect(absoluteRect(list)).toEqual({
      left: 1,
      top: 20,
      width: 78,
      height: 3,
    });
  });

  it("возвращает undefined для оторванного элемента", () => {
    expect(absoluteRect(null)).toBeUndefined();
    expect(absoluteRect({})).toBeUndefined();
  });

  it("проверяет попадание точки в прямоугольник по обеим осям", () => {
    const rect = { left: 2, top: 10, width: 4, height: 2 };
    expect(containsPoint(rect, 2, 10)).toBe(true);
    expect(containsPoint(rect, 5, 11)).toBe(true);
    expect(containsPoint(rect, 6, 11)).toBe(false);
    expect(containsPoint(rect, 3, 12)).toBe(false);
    expect(containsPoint(undefined, 3, 10)).toBe(false);
  });

  it("переводит строку экрана в индекс строки списка", () => {
    const rect = { left: 0, top: 10, width: 20, height: 3 };
    expect(rowWithin(rect, 10)).toBe(0);
    expect(rowWithin(rect, 12)).toBe(2);
    expect(rowWithin(rect, 13)).toBeUndefined();
    expect(rowWithin(rect, 9)).toBeUndefined();
  });
});
