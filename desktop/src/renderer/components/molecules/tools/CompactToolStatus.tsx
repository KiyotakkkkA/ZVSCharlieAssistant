import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { ChevronDownIcon, type SvgIcon } from "../../atoms";

type ToolStatus = "requested" | "running" | "completed" | "failed";

interface CompactToolStatusContextValue {
  expanded: boolean;
  expandable: boolean;
  contentId: string;
  toggle: () => void;
}

const CompactToolStatusContext =
  createContext<CompactToolStatusContextValue | null>(null);

function useCompactToolStatus() {
  const context = useContext(CompactToolStatusContext);
  if (!context) {
    throw new Error(
      "CompactToolStatus components must be used inside CompactToolStatus",
    );
  }
  return context;
}

export interface CompactToolStatusProps {
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

function CompactToolStatusRoot({
  children,
  defaultExpanded = false,
  className = "",
}: CompactToolStatusProps) {
  const expandable = Children.toArray(children).some(
    (child) => isValidElement(child) && child.type === Expandable,
  );
  const [expanded, setExpanded] = useState(defaultExpanded && expandable);
  const contentId = useId();

  return (
    <CompactToolStatusContext.Provider
      value={{
        expanded,
        expandable,
        contentId,
        toggle: () => expandable && setExpanded((current) => !current),
      }}
    >
      <div className={className}>{children}</div>
    </CompactToolStatusContext.Provider>
  );
}

export interface CompactToolStatusTriggerProps extends Omit<
  ComponentPropsWithoutRef<"button">,
  "children"
> {
  icon: SvgIcon;
  running: string;
  completed: string;
  failed?: string;
  status: ToolStatus;
}

function Trigger({
  icon: Icon,
  running,
  completed,
  failed,
  status,
  className = "",
  ...buttonProps
}: CompactToolStatusTriggerProps) {
  const { expanded, expandable, contentId, toggle } = useCompactToolStatus();
  const label =
    status === "failed"
      ? (failed ?? completed)
      : status === "completed"
        ? completed
        : running;
  const content = (
    <>
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-main-800/60 text-main-400">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1 text-left">{label}</span>
      {expandable ? (
        <ChevronDownIcon
          aria-hidden="true"
          className={`size-4 shrink-0 text-main-500 transition-transform duration-300 ease-out ${expanded ? "rotate-180" : "rotate-0"}`}
        />
      ) : null}
    </>
  );
  const classes = `flex w-full items-center gap-2.5 py-1.5 text-xs text-main-400 ${
    expandable
      ? "cursor-pointer rounded-lg transition-colors hover:text-main-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-medium/50"
      : ""
  } ${className}`;

  return expandable ? (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={contentId}
      onClick={toggle}
      className={classes}
      {...buttonProps}
    >
      {content}
    </button>
  ) : (
    <div className={classes}>{content}</div>
  );
}

export interface CompactToolStatusExpandableProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
}

function Expandable({
  children,
  className = "",
  ...props
}: CompactToolStatusExpandableProps) {
  const { expanded, contentId } = useCompactToolStatus();

  return (
    <div
      id={contentId}
      aria-hidden={!expanded}
      className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
        expanded
          ? "mt-1 grid-rows-[1fr] opacity-100"
          : "mt-0 grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={`rounded-xl border border-main-700/60 bg-main-900/45 px-4 py-3 text-xs leading-5 text-main-400 ${className}`}
          {...props}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export const CompactToolStatus = Object.assign(CompactToolStatusRoot, {
  Trigger,
  Expandable,
});
