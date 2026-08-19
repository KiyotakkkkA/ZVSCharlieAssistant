import { useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { InputBig, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { hasExpression } from "../../../shared/expressions";
import {
  ExpressionInput,
  ExpressionScopeContext,
  type ExpressionInputHandle,
} from "./ExpressionInput";
import { preview } from "./expression/preview";

const MAX_FIELDS = 40;

interface Props {
  label: ReactNode;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  hint?: ReactNode;
  multiline?: boolean;
  minRows?: number;
  maxRows?: number;
}

export function ExpressionField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  multiline = false,
  minRows = 3,
  maxRows = 8,
}: Props) {
  const scope = useContext(ExpressionScopeContext);
  const inputRef = useRef<ExpressionInputHandle | null>(null);
  const [mode, setMode] = useState<"fixed" | "expression">(() =>
    hasExpression(value) ? "expression" : "fixed",
  );
  const [picking, setPicking] = useState(false);

  const fields = useMemo(() => collectFields(scope.values), [scope.values]);
  const result = useMemo(
    () => (mode === "expression" ? preview(value, scope) : null),
    [mode, scope, value],
  );

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 text-xs font-medium text-main-400">{label}</div>
        <div className="flex shrink-0 rounded-md bg-main-800 p-0.5 ring-1 ring-main-700">
          <ModeButton
            active={mode === "fixed"}
            onClick={() => setMode("fixed")}
          >
            Значение
          </ModeButton>
          <ModeButton
            active={mode === "expression"}
            onClick={() => setMode("expression")}
          >
            Выражение
          </ModeButton>
        </div>
      </div>

      {mode === "fixed" ? (
        multiline ? (
          <InputBig
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            minRows={minRows}
            maxRows={maxRows}
            autoResize
          />
        ) : (
          <InputSmall
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full"
          />
        )
      ) : (
        <>
          <ExpressionInput
            ref={inputRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? "{{ $json.text }}"}
            multiline={multiline}
            minRows={minRows}
            maxRows={maxRows}
          />

          <div className="relative mt-1.5">
            <button
              type="button"
              disabled={fields.length === 0}
              onClick={() => setPicking((open) => !open)}
              className="rounded-md px-2 py-1 text-[11px] text-main-400 ring-1 ring-main-700 transition-colors enabled:hover:bg-main-700/50 enabled:hover:text-main-100 disabled:opacity-50"
            >
              {fields.length
                ? "Вставить данные"
                : "Данных пока нет — запустите сценарий"}
            </button>

            {picking ? (
              <ul className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-main-800 py-1 shadow-lg ring-1 ring-main-700">
                {fields.map((field) => (
                  <li key={field.path}>
                    <button
                      type="button"
                      onClick={() => {
                        inputRef.current?.insert(`{{ ${field.path} }}`);
                        setPicking(false);
                      }}
                      className="flex w-full items-baseline gap-2 px-2.5 py-1 text-left transition-colors hover:bg-main-700/60"
                    >
                      <span className="font-mono text-xs text-accent-light">
                        {field.label}
                      </span>
                      <span className="ml-auto max-w-[55%] truncate text-[10px] text-main-500">
                        {field.sample}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {result && result.state !== "empty" ? (
            <div className="mt-1.5 rounded-md bg-main-800/70 px-2.5 py-1.5 ring-1 ring-main-700/70">
              {result.state === "error" ? (
                <p className="text-[11px] leading-4 text-danger-light">
                  {result.message}
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-main-500">
                    Результат · {result.type}
                  </p>
                  <p className="mt-0.5 max-h-24 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-4 text-main-100">
                    {result.text || "— пусто —"}
                  </p>
                </>
              )}
            </div>
          ) : null}
        </>
      )}

      {hint}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
        active
          ? "bg-main-600/70 text-main-50"
          : "text-main-500 hover:text-main-200"
      }`}
    >
      {children}
    </button>
  );
}

interface PickerField {
  path: string;
  label: string;
  sample: string;
}

function collectFields(values: Record<string, unknown>): PickerField[] {
  const fields: PickerField[] = [];

  const walk = (root: string, value: unknown, depth: number) => {
    if (fields.length >= MAX_FIELDS) return;
    if (!isRecord(value)) return;
    for (const [key, item] of Object.entries(value)) {
      if (fields.length >= MAX_FIELDS) return;
      const path = `${root}.${key}`;
      fields.push({ path, label: path, sample: describe(item) });
      if (depth < 2) walk(path, item, depth + 1);
    }
  };

  walk("$json", values.$json, 1);
  walk("$trigger", values.$trigger, 1);
  return fields;
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return "пусто";
  if (Array.isArray(value)) return `список, ${value.length}`;
  if (typeof value === "object") return "объект";
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
