import { useCallback, useEffect, useRef, useState } from "react";

export interface VirtualWindow {
  containerRef: (element: HTMLDivElement | null) => void;
  onScroll: () => void;
  start: number;
  end: number;
  paddingTop: number;
  paddingBottom: number;
}

export function useVirtualRows(
  count: number,
  rowHeight: number,
  overscan = 6,
): VirtualWindow {
  const element = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [height, setHeight] = useState(0);

  const measure = useCallback(() => {
    const node = element.current;
    if (!node) return;
    setOffset(node.scrollTop);
    setHeight(node.clientHeight);
  }, []);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    element.current = node;
    if (node) {
      setOffset(node.scrollTop);
      setHeight(node.clientHeight);
    }
  }, []);

  useEffect(() => {
    const node = element.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  return {
    containerRef,
    onScroll: measure,
    ...virtualWindow({ count, rowHeight, offset, height, overscan }),
  };
}

export interface VirtualWindowInput {
  count: number;
  rowHeight: number;
  offset: number;
  height: number;
  overscan: number;
}

export function virtualWindow({
  count,
  rowHeight,
  offset,
  height,
  overscan,
}: VirtualWindowInput) {
  const visible = height ? Math.ceil(height / rowHeight) : count;
  const start = Math.max(0, Math.floor(offset / rowHeight) - overscan);
  const end = Math.min(count, start + visible + overscan * 2);
  return {
    start,
    end,
    paddingTop: start * rowHeight,
    paddingBottom: Math.max(0, (count - end) * rowHeight),
  };
}
