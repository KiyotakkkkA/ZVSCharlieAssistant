import {
  createContext,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { SPAN_CLASS, highlight } from "./expression/highlight";
import {
  EMPTY_SCOPE,
  readContext,
  suggest,
  type CompletionContext,
  type ExpressionScope,
  type Suggestion,
} from "./expression/completions";

export const ExpressionScopeContext =
  createContext<ExpressionScope>(EMPTY_SCOPE);

export function ExpressionScopeProvider({
  scope,
  children,
}: {
  scope: ExpressionScope;
  children: ReactNode;
}) {
  return (
    <ExpressionScopeContext.Provider value={scope}>
      {children}
    </ExpressionScopeContext.Provider>
  );
}

const SHARED_TEXT =
  "w-full px-3 py-2 font-mono text-xs leading-5 whitespace-pre-wrap break-words";

export interface ExpressionInputHandle {
  insert(text: string): void;
}

interface Props {
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  multiline?: boolean;
  minRows?: number;
  maxRows?: number;
}

export const ExpressionInput = forwardRef<ExpressionInputHandle, Props>(
  function ExpressionInput(
    {
      value,
      onChange,
      placeholder,
      multiline = false,
      minRows = 3,
      maxRows = 8,
    },
    handleRef,
  ) {
    const scope = useContext(ExpressionScopeContext);
    const areaRef = useRef<HTMLTextAreaElement | null>(null);
    const layerRef = useRef<HTMLPreElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const [context, setContext] = useState<CompletionContext | null>(null);
    const [active, setActive] = useState(0);

    const spans = useMemo(() => highlight(value), [value]);
    const suggestions = useMemo(
      () => suggest(context, scope),
      [context, scope],
    );

    const close = useCallback(() => setContext(null), []);

    useImperativeHandle(
      handleRef,
      () => ({
        insert(text: string) {
          const element = areaRef.current;
          const current = element?.value ?? value;
          const caret = element?.selectionStart ?? current.length;
          const next = current.slice(0, caret) + text + current.slice(caret);
          onChange(next);
          const position = caret + text.length;
          requestAnimationFrame(() => {
            const target = areaRef.current;
            if (!target) return;
            target.focus();
            target.setSelectionRange(position, position);
          });
        },
      }),
      [onChange, value],
    );

    const refresh = useCallback((element: HTMLTextAreaElement) => {
      setContext(readContext(element.value, element.selectionStart ?? 0));
      setActive(0);
    }, []);

    const accept = useCallback(
      (entry: Suggestion) => {
        const element = areaRef.current;
        if (!element || !context) return;

        const current = element.value;
        const caret = element.selectionStart ?? current.length;
        const next =
          current.slice(0, context.from) +
          entry.insert.text +
          current.slice(caret);

        onChange(next);
        close();

        const position = context.from + entry.insert.caret;
        requestAnimationFrame(() => {
          const target = areaRef.current;
          if (!target) return;
          target.focus();
          target.setSelectionRange(position, position);
        });
      },
      [close, context, onChange],
    );

    const onKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.ctrlKey && event.code === "Space") {
          event.preventDefault();
          const element = event.currentTarget;
          const caret = element.selectionStart ?? 0;
          setContext(
            readContext(element.value, caret) ?? {
              kind: "root",
              token: "",
              from: caret,
            },
          );
          setActive(0);
          return;
        }

        const open = Boolean(context) && suggestions.length > 0;

        if (open) {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % suggestions.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(
              (index) => (index - 1 + suggestions.length) % suggestions.length,
            );
            return;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            const entry = suggestions[active];
            if (entry) accept(entry);
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }
        }

        if (event.key === "Enter" && !multiline) event.preventDefault();
      },
      [accept, active, close, context, multiline, suggestions],
    );

    useEffect(() => {
      if (!context) return;
      const onPointerDown = (event: PointerEvent) => {
        if (!containerRef.current?.contains(event.target as Node)) close();
      };
      document.addEventListener("pointerdown", onPointerDown);
      return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [close, context]);

    const rows = multiline ? minRows : 1;
    const open = Boolean(context) && suggestions.length > 0;

    return (
      <div ref={containerRef} className="relative">
        <div className="relative overflow-hidden rounded-lg bg-main-800 ring-1 ring-main-700 focus-within:ring-accent-medium/70">
          <pre
            ref={layerRef}
            aria-hidden
            className={`pointer-events-none absolute inset-0 m-0 overflow-hidden ${SHARED_TEXT}`}
          >
            <HighlightedText value={value} spans={spans} />
          </pre>
          <textarea
            ref={areaRef}
            value={value}
            rows={rows}
            spellCheck={false}
            placeholder={placeholder}
            onChange={(event) => {
              onChange(event.target.value);
              refresh(event.currentTarget);
            }}
            onSelect={(event) => refresh(event.currentTarget)}
            onKeyDown={onKeyDown}
            onBlur={close}
            onScroll={(event) => {
              const layer = layerRef.current;
              if (layer) layer.scrollTop = event.currentTarget.scrollTop;
            }}
            style={{
              maxHeight: multiline ? `${maxRows * 1.25}rem` : undefined,
            }}
            className={`relative block resize-none bg-transparent text-transparent caret-main-50 outline-none placeholder:text-main-600 ${SHARED_TEXT}`}
          />
        </div>

        {open ? (
          <ul
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg bg-main-800 py-1 shadow-lg ring-1 ring-main-700"
          >
            {suggestions.map((entry, index) => (
              <li key={`${entry.kind}-${entry.label}-${index}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => accept(entry)}
                  className={`flex w-full items-baseline gap-2 px-2.5 py-1 text-left transition-colors ${
                    index === active ? "bg-main-700/70" : "hover:bg-main-700/40"
                  }`}
                >
                  <span
                    className={`font-mono text-xs ${
                      entry.kind === "method"
                        ? "text-info-light"
                        : entry.kind === "function"
                          ? "text-warning-light"
                          : "text-accent-light"
                    }`}
                  >
                    {entry.label}
                  </span>
                  {entry.signature ? (
                    <span className="font-mono text-[10px] text-main-500">
                      {entry.signature}
                    </span>
                  ) : null}
                  <span className="ml-auto max-w-[55%] truncate text-[10px] text-main-500">
                    {entry.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);

const HighlightedText = memo(function HighlightedText({
  value,
  spans,
}: {
  value: string;
  spans: ReturnType<typeof highlight>;
}) {
  return (
    <>
      {spans.map((span, index) => (
        <span key={index} className={SPAN_CLASS[span.kind]}>
          {value.slice(span.start, span.end)}
        </span>
      ))}
      {/* A trailing newline needs a character after it or the layer ends one
          line short of the textarea. */}
      {"\n"}
    </>
  );
});
