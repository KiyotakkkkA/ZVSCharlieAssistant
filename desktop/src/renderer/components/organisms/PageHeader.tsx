import { useEffect, useRef, useState, type ReactNode } from "react";
import { AppBreadcrumbs, type AppBreadcrumbItem } from "../atoms";

interface PageHeaderProps {
  title: ReactNode;
  leading?: ReactNode;
  description?: ReactNode;
  breadcrumbs?: AppBreadcrumbItem[];
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  leading,
  description,
  breadcrumbs,
  children,
  footer,
  className = "",
}: PageHeaderProps) {
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const findScrollParent = (element: HTMLElement): HTMLElement | null => {
      let parent = element.parentElement;
      while (parent) {
        const { overflowY } = window.getComputedStyle(parent);
        if (/(auto|scroll|overlay)/.test(overflowY)) return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const scrollParent = findScrollParent(sentinel);
    const scrollTarget: HTMLElement | Window = scrollParent ?? window;

    const updateStuckState = () => {
      const sentinelTop = sentinel.getBoundingClientRect().top;
      const containerTop = scrollParent
        ? scrollParent.getBoundingClientRect().top
        : 0;
      const hasScrolled = scrollParent
        ? scrollParent.scrollTop > 0
        : window.scrollY > 0;

      setIsStuck(hasScrolled && sentinelTop <= containerTop + 1);
    };

    updateStuckState();
    scrollTarget.addEventListener("scroll", updateStuckState, {
      passive: true,
    });
    window.addEventListener("resize", updateStuckState);

    return () => {
      scrollTarget.removeEventListener("scroll", updateStuckState);
      window.removeEventListener("resize", updateStuckState);
    };
  }, []);

  return (
    <>
      <span ref={sentinelRef} aria-hidden className="block h-px w-full" />
      <header
        data-stuck={isStuck || undefined}
        className={[
          "sticky top-0 z-30 isolate mb-5 border-x border-b px-1",
          "transition-[top,padding,background-color,border-color,border-radius,box-shadow,backdrop-filter] duration-300 ease-out",
          isStuck
            ? [
                "rounded-b-xl border-main-700/70 bg-main-900 px-4 py-3",
                "supports-[backdrop-filter:blur(1px)]:bg-main-900/85",
                "backdrop-blur-2xl",
                "shadow-[0_10px_24px_rgb(0_0_0/0.24)]",
              ].join(" ")
            : "border-main-800/0 border-b-main-800 bg-transparent pb-4 shadow-none",
          className,
        ].join(" ")}
      >
        <div
          className={[
            "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-8",
            isStuck ? "items-center gap-3" : "gap-4",
          ].join(" ")}
        >
          <div
            className={[
              "flex min-w-0 items-start gap-2",
              isStuck ? "" : "self-end py-1",
            ].join(" ")}
          >
            {leading ? <div className="shrink-0">{leading}</div> : null}
            <div className="min-w-0">
              <h1
                className={[
                  "truncate font-semibold tracking-tight text-main-50 transition-[font-size,line-height] duration-200",
                  isStuck ? "text-lg leading-6" : "text-2xl leading-8",
                ].join(" ")}
              >
                {title}
              </h1>
              {description ? (
                <p
                  className={[
                    "max-w-2xl overflow-hidden text-sm leading-6 text-main-400",
                    "transition-[max-height,margin,opacity] duration-200",
                    isStuck
                      ? "mt-0 max-h-0 opacity-0"
                      : "mt-2 max-h-20 opacity-100",
                  ].join(" ")}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={[
              "flex min-w-0 items-end justify-between",
              isStuck
                ? "flex-row gap-4 md:min-w-0 md:items-center"
                : "flex-col gap-4 md:min-w-64",
            ].join(" ")}
          >
            {breadcrumbs && <AppBreadcrumbs items={breadcrumbs} />}
            {children ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {children}
              </div>
            ) : null}
          </div>
        </div>

        {footer ? (
          <div
            className={[
              "flex items-center overflow-hidden transition-[max-height,margin,padding,opacity] duration-200",
              isStuck
                ? "mt-0 max-h-0 p-0 opacity-0"
                : "mt-4 max-h-20 min-h-9 pt-4 opacity-100",
            ].join(" ")}
          >
            {footer}
          </div>
        ) : null}
      </header>
    </>
  );
}
