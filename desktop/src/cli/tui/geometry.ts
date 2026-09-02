export interface ScreenRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface LayoutBox {
  getComputedLayout(): {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface LayoutNode {
  yogaNode?: LayoutBox;
  parentNode?: LayoutNode | undefined;
}

export function absoluteRect(node: LayoutNode | null): ScreenRect | undefined {
  const own = node?.yogaNode?.getComputedLayout();
  if (!own) return undefined;
  let left = own.left;
  let top = own.top;
  let parent = node?.parentNode;
  while (parent) {
    const layout = parent.yogaNode?.getComputedLayout();
    if (layout) {
      left += layout.left;
      top += layout.top;
    }
    parent = parent.parentNode;
  }
  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(own.width),
    height: Math.round(own.height),
  };
}

export function containsPoint(
  rect: ScreenRect | undefined,
  x: number,
  y: number,
): boolean {
  if (!rect) return false;
  return (
    x >= rect.left &&
    x < rect.left + rect.width &&
    y >= rect.top &&
    y < rect.top + rect.height
  );
}

export function rowWithin(
  rect: ScreenRect | undefined,
  y: number,
  insetTop = 0,
  rows = Number.POSITIVE_INFINITY,
): number | undefined {
  if (!rect) return undefined;
  const row = y - rect.top - insetTop;
  if (row < 0 || row >= rows || y >= rect.top + rect.height) return undefined;
  return row;
}
