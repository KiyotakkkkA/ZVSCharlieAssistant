import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button, Tooltip } from "@kiyotakkkka/zvs-uikit-lib";
import { ArrowExpandLeftIcon, ArrowExpandRightIcon } from "../atoms";

const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
const COLLAPSED_WIDTH = 44;

interface Props {
  title: string;
  storageKey: string;
  defaultWidth?: number;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function ResizableSidePanel({
  title,
  storageKey,
  defaultWidth = 384,
  headerAction,
  children,
}: Props) {
  const [width, setWidth] = useState(() =>
    readNumber(`${storageKey}.width`, defaultWidth),
  );
  const [collapsed, setCollapsed] = useState(() =>
    readFlag(`${storageKey}.collapsed`),
  );
  const [resizing, setResizing] = useState(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem(`${storageKey}.width`, String(width));
  }, [storageKey, width]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}.collapsed`, collapsed ? "1" : "0");
  }, [storageKey, collapsed]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (collapsed) return;
      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      setResizing(true);

      const move = (moveEvent: PointerEvent) => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          const next = window.innerWidth - moveEvent.clientX;
          setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
        });
      };
      const stop = () => {
        setResizing(false);
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        handle.removeEventListener("pointercancel", stop);
      };

      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
    },
    [collapsed],
  );

  return (
    <aside
      className={[
        "relative flex shrink-0 flex-col border-l border-main-800 bg-main-900/90",
        resizing ? "" : "transition-[width] duration-200 ease-out",
      ].join(" ")}
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину панели"
        onPointerDown={startResize}
        onDoubleClick={() => setWidth(defaultWidth)}
        className={[
          "absolute inset-y-0 -left-px z-10 w-1.5",
          collapsed ? "hidden" : "cursor-col-resize",
          resizing ? "bg-accent-medium/60" : "hover:bg-accent-medium/40",
        ].join(" ")}
      />

      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-main-800 px-2">
        <Tooltip
          label={collapsed ? "Развернуть панель" : "Свернуть панель"}
          placement="bottom-right"
        >
          <Button
            variant="ghost"
            rounded="rounded-lg"
            label={collapsed ? "Развернуть панель" : "Свернуть панель"}
            className="inline-flex size-8 shrink-0 items-center justify-center border-0! p-0 text-main-400 shadow-none ring-0! hover:bg-main-600/50 hover:text-main-50"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ArrowExpandLeftIcon className="size-4" />
            ) : (
              <ArrowExpandRightIcon className="size-4" />
            )}
          </Button>
        </Tooltip>
        {collapsed ? null : (
          <>
            <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-main-200">
              {title}
            </h2>
            {headerAction}
          </>
        )}
      </div>

      {collapsed ? null : (
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      )}
    </aside>
  );
}

function readNumber(key: string, fallback: number): number {
  const raw = Number(localStorage.getItem(key));
  return Number.isFinite(raw) && raw >= MIN_WIDTH && raw <= MAX_WIDTH
    ? raw
    : fallback;
}

function readFlag(key: string): boolean {
  return localStorage.getItem(key) === "1";
}
