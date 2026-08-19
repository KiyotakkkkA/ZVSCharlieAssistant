import { useCallback, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}

export function HoverTooltip({ label, children, className }: Props) {
  const anchor = useRef<HTMLSpanElement | null>(null);
  const [point, setPoint] = useState<{ top: number; left: number } | null>(
    null,
  );

  const show = useCallback(() => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box) return;
    setPoint({ top: box.top + box.height / 2, left: box.right + 8 });
  }, []);

  const hide = useCallback(() => setPoint(null), []);

  return (
    <>
      <span
        ref={anchor}
        className={className}
        onPointerEnter={show}
        onPointerLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
      >
        {children}
      </span>
      {point
        ? createPortal(
            <div
              role="tooltip"
              style={{ top: point.top, left: point.left }}
              className="pointer-events-none fixed z-999 -translate-y-1/2 whitespace-nowrap rounded-lg border border-main-700/80 bg-main-900/95 px-2.5 py-1.5 text-xs text-main-200 shadow-lg"
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
