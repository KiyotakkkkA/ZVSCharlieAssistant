import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type AnimatedSlidedPanelSide = "left" | "right";

export interface AnimatedSlidedPanelState {
  collapsed: boolean;
  contentVisible: boolean;
  resizing: boolean;
  toggle: () => void;
}

interface AnimatedSlidedPanelProps {
  dataTour?: string;
  storageKey?: string;
  side?: AnimatedSlidedPanelSide;
  defaultCollapsed?: boolean;
  defaultWidth: number;
  collapsedWidth: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  transitionDuration?: number;
  className?:
    | string
    | ((state: AnimatedSlidedPanelState) => string);
  style?: CSSProperties;
  header?: (state: AnimatedSlidedPanelState) => ReactNode;
  children: ReactNode;
  collapsedContent?: ReactNode;
  contentClassName?:
    | string
    | ((state: AnimatedSlidedPanelState) => string);
  onCollapsedChange?: (collapsed: boolean) => void;
}

const FADE_OUT_MS = 140;

export function AnimatedSlidedPanel({
  dataTour,
  storageKey,
  side = "left",
  defaultCollapsed = false,
  defaultWidth,
  collapsedWidth,
  minWidth = defaultWidth,
  maxWidth = defaultWidth,
  resizable = false,
  transitionDuration = 300,
  className,
  style,
  header,
  children,
  collapsedContent,
  contentClassName = "min-h-0 flex-1",
  onCollapsedChange,
}: AnimatedSlidedPanelProps) {
  const [width, setWidth] = useState(() =>
    readNumber(storageKey && `${storageKey}.width`, defaultWidth, minWidth, maxWidth),
  );
  const [collapsed, setCollapsed] = useState(() =>
    readFlag(storageKey && `${storageKey}.collapsed`, defaultCollapsed),
  );
  const [contentVisible, setContentVisible] = useState(true);
  const [resizing, setResizing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const frame = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (storageKey)
      localStorage.setItem(`${storageKey}.width`, String(width));
  }, [storageKey, width]);

  useEffect(() => {
    if (storageKey)
      localStorage.setItem(`${storageKey}.collapsed`, collapsed ? "1" : "0");
  }, [storageKey, collapsed]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  const toggle = useCallback(() => {
    if (!contentVisible || resizing) return;
    setContentVisible(false);
    timers.current.push(
      window.setTimeout(() => {
        setCollapsed((current) => {
          const next = !current;
          onCollapsedChange?.(next);
          return next;
        });
        timers.current.push(
          window.setTimeout(
            () => {
              setContentVisible(true);
              timers.current = [];
            },
            transitionDuration,
          ),
        );
      }, FADE_OUT_MS),
    );
  }, [contentVisible, onCollapsedChange, resizing, transitionDuration]);

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!resizable || collapsed) return;
      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      setResizing(true);

      const move = (moveEvent: PointerEvent) => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const bounds = panelRef.current?.getBoundingClientRect();
          if (!bounds) return;
          const next =
            side === "left"
              ? moveEvent.clientX - bounds.left
              : bounds.right - moveEvent.clientX;
          setWidth(Math.min(maxWidth, Math.max(minWidth, next)));
        });
      };
      const stop = () => {
        setResizing(false);
        if (handle.hasPointerCapture(event.pointerId))
          handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        handle.removeEventListener("pointercancel", stop);
      };

      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
    },
    [collapsed, maxWidth, minWidth, resizable, side],
  );

  const state: AnimatedSlidedPanelState = {
    collapsed,
    contentVisible,
    resizing,
    toggle,
  };
  const resolvedClassName =
    typeof className === "function" ? className(state) : (className ?? "");
  const resolvedContentClassName =
    typeof contentClassName === "function"
      ? contentClassName(state)
      : contentClassName;

  return (
    <aside
      ref={panelRef}
      data-tour={dataTour}
      data-collapsed={collapsed ? "true" : "false"}
      data-side={side}
      className={[
        "relative shrink-0",
        resizing
          ? ""
          : "transition-[width,background-color] ease-out",
        resolvedClassName,
      ].join(" ")}
      style={{
        ...style,
        width: collapsed ? collapsedWidth : width,
        transitionDuration: resizing ? undefined : `${transitionDuration}ms`,
      }}
    >
      {resizable ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Изменить ширину панели"
          onPointerDown={startResize}
          onDoubleClick={() => setWidth(defaultWidth)}
          className={[
            "absolute inset-y-0 z-10 w-1.5",
            side === "left" ? "-right-px" : "-left-px",
            collapsed ? "hidden" : "cursor-col-resize",
            resizing ? "bg-accent-medium/60" : "hover:bg-accent-medium/40",
          ].join(" ")}
        />
      ) : null}

      {header?.(state)}
      <div
        aria-hidden={!contentVisible}
        className={[
          resolvedContentClassName,
          "transition-[opacity,transform] duration-150 ease-out",
          contentVisible
            ? "pointer-events-auto translate-x-0 opacity-100"
            : `pointer-events-none overflow-hidden opacity-0 ${side === "left" ? "-translate-x-1" : "translate-x-1"}`,
        ].join(" ")}
      >
        {collapsed ? collapsedContent : children}
      </div>
    </aside>
  );
}

function readNumber(
  key: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!key) return fallback;
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw >= min && raw <= max ? raw : fallback;
}

function readFlag(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback;
  const value = localStorage.getItem(key);
  return value === null ? fallback : value === "1";
}
