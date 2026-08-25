import type { ReactNode } from "react";
import { Button, Tooltip } from "@kiyotakkkka/zvs-uikit-lib";
import { ArrowExpandLeftIcon, ArrowExpandRightIcon } from "../atoms";
import { AnimatedSlidedPanel } from "./AnimatedSlidedPanel";

const MIN_WIDTH = 280;
const MAX_WIDTH = 720;
const COLLAPSED_WIDTH = 56;

interface Props {
  dataTour?: string;
  title: string;
  storageKey: string;
  side?: "left" | "right";
  defaultWidth?: number;
  headerAction?: ReactNode;
  collapsedContent?: ReactNode;
  children: ReactNode;
}

export function ResizableSidePanel({
  dataTour,
  title,
  storageKey,
  side = "right",
  defaultWidth = 384,
  headerAction,
  collapsedContent,
  children,
}: Props) {
  return (
    <AnimatedSlidedPanel
      dataTour={dataTour}
      storageKey={storageKey}
      side={side}
      defaultWidth={defaultWidth}
      collapsedWidth={COLLAPSED_WIDTH}
      minWidth={MIN_WIDTH}
      maxWidth={MAX_WIDTH}
      resizable
      className="z-20 flex flex-col border-main-800 bg-main-900/90 data-[side=left]:border-r data-[side=right]:border-l"
      contentClassName={({ collapsed }) =>
        `min-h-0 flex-1 ${collapsed ? "overflow-visible" : "overflow-hidden"}`
      }
      collapsedContent={collapsedContent}
      header={({ collapsed, contentVisible, toggle }) => (
        <div
          className={[
            "flex h-12 shrink-0 items-center justify-between gap-2 border-b border-main-800 px-2",
            side === "left" ? "flex-row-reverse" : "",
          ].join(" ")}
        >
          <Tooltip
            label={collapsed ? "Развернуть панель" : "Свернуть панель"}
            placement={side === "left" ? "bottom-left" : "bottom-right"}
          >
            <Button
              variant="ghost"
              rounded="rounded-lg"
              label={collapsed ? "Развернуть панель" : "Свернуть панель"}
              aria-expanded={!collapsed}
              className="inline-flex size-8 shrink-0 items-center justify-center border-0! p-0 text-main-400 shadow-none ring-0! hover:bg-main-600/50 hover:text-main-50"
              disabled={!contentVisible}
              onClick={toggle}
            >
              {collapsed === (side === "left") ? (
                <ArrowExpandRightIcon className="size-4" />
              ) : (
                <ArrowExpandLeftIcon className="size-4" />
              )}
            </Button>
          </Tooltip>
          {collapsed ? null : (
            <div
              className={[
                "flex min-w-0 flex-1 items-center gap-2 transition-opacity duration-150",
                contentVisible ? "opacity-100" : "opacity-0",
              ].join(" ")}
            >
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-main-200">
                {title}
              </h2>
              {headerAction}
            </div>
          )}
        </div>
      )}
    >
      {children}
    </AnimatedSlidedPanel>
  );
}
