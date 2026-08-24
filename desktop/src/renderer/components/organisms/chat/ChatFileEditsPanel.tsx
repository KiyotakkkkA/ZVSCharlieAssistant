import { useMemo, useState } from "react";
import type { FileEditRecord } from "../../../../ipc/contracts";

interface ChatFileEditsPanelProps {
  open: boolean;
  edits: FileEditRecord[];
  onClose: () => void;
  onRevertRun: (runId: string) => Promise<{ restored: string[]; failed: string[] }>;
}

const OPERATION_LABELS: Record<FileEditRecord["operation"], string> = {
  create: "создан",
  modify: "изменён",
  delete: "удалён",
  move: "перемещён",
};

export function ChatFileEditsPanel({
  open,
  edits,
  onClose,
  onRevertRun,
}: ChatFileEditsPanelProps) {
  const [reverting, setReverting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byRun = new Map<string, FileEditRecord[]>();
    for (const edit of edits) {
      const key = edit.runId ?? "manual";
      byRun.set(key, [...(byRun.get(key) ?? []), edit]);
    }
    return [...byRun.entries()].reverse();
  }, [edits]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 flex justify-end bg-main-900/60">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-main-700/50 bg-main-800">
        <header className="flex items-center justify-between border-b border-main-700/50 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-main-50">
              Правки файлов
            </h2>
            <p className="mt-0.5 text-xs text-main-500">
              {edits.length
                ? `${edits.length} изменений в ${groups.length} задачах`
                : "Изменений пока нет"}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs text-main-400 hover:bg-main-700/45 hover:text-main-50"
            onClick={onClose}
          >
            Закрыть
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {groups.map(([runId, group]) => (
            <section key={runId} className="mb-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs text-main-500">
                  Задача {runId.slice(0, 8)} · {group.length} файлов
                </span>
                {runId !== "manual" && group.some((item) => !item.reverted) ? (
                  <button
                    type="button"
                    className="rounded-lg px-2 py-1 text-xs text-amber-300 hover:bg-main-700/45 disabled:opacity-50"
                    disabled={reverting === runId}
                    onClick={() => {
                      setReverting(runId);
                      void onRevertRun(runId).finally(() => setReverting(null));
                    }}
                  >
                    {reverting === runId ? "Откатываю…" : "Откатить все"}
                  </button>
                ) : null}
              </div>

              {group.map((edit) => (
                <article
                  key={edit.id}
                  className="mb-2 overflow-hidden rounded-xl bg-main-700/25"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                    onClick={() =>
                      setExpanded(expanded === edit.id ? null : edit.id)
                    }
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-main-200">
                      {edit.path}
                      {edit.movedTo ? ` → ${edit.movedTo}` : ""}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-main-500">
                      {OPERATION_LABELS[edit.operation]}
                      {edit.reverted ? " · откачен" : ""}
                    </span>
                  </button>
                  {expanded === edit.id ? (
                    <pre className="max-h-96 overflow-auto border-t border-main-700/40 px-3 py-2 text-[11px] leading-5">
                      {renderDiff(edit.diff)}
                    </pre>
                  ) : null}
                </article>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderDiff(diff: string) {
  if (!diff.trim()) return <span className="text-main-500">Дифф пуст</span>;
  return diff.split("\n").map((line, index) => (
    <div
      key={index}
      className={
        line.startsWith("+") && !line.startsWith("+++")
          ? "text-emerald-300"
          : line.startsWith("-") && !line.startsWith("---")
            ? "text-rose-300"
            : line.startsWith("@@")
              ? "text-accent-light"
              : "text-main-400"
      }
    >
      {line || " "}
    </div>
  ));
}
