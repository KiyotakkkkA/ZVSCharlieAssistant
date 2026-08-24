import { useMemo, useState } from "react";
import { Button, Modal, ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import type { FileEditRecord } from "../../../../ipc/contracts";
import { FileIcon } from "../../atoms";

interface ChatFileEditsPanelProps {
  open: boolean;
  edits: FileEditRecord[];
  onClose: () => void;
  onRevertRun: (
    runId: string,
  ) => Promise<{ restored: string[]; failed: string[] }>;
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

  return (
    <Modal
      open={open}
      rounded="rounded-4xl"
      className="max-w-3xl"
      onClose={onClose}
    >
      <Modal.Header>
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
            <FileIcon className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-main-50">
              Правки файлов
            </h2>
            <p className="mt-0.5 text-xs text-main-500">
              {edits.length
                ? `${edits.length} изменений в ${groups.length} задачах`
                : "Изменений пока нет"}
            </p>
          </div>
        </div>
      </Modal.Header>
      <Modal.Content className="p-0!">
        <ScrollArea className="max-h-[min(34rem,70vh)]">
          <div className="px-5 py-4">
            {groups.map(([runId, group]) => (
              <section key={runId} className="mb-6 last:mb-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-main-500">
                    Задача {runId.slice(0, 8)} · {group.length} файлов
                  </span>
                  {runId !== "manual" &&
                  group.some((item) => !item.reverted) ? (
                    <Button
                      type="button"
                      variant="warning-outline"
                      size="sm"
                      rounded="rounded-lg"
                      loading={reverting === runId}
                      loadingText="Откатываю..."
                      onClick={() => {
                        setReverting(runId);
                        void onRevertRun(runId).finally(() =>
                          setReverting(null),
                        );
                      }}
                    >
                      Откатить все
                    </Button>
                  ) : null}
                </div>

                {group.map((edit) => (
                  <article
                    key={edit.id}
                    className="mb-2 overflow-hidden rounded-lg bg-main-800/35 ring-1 ring-main-700/35"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      rounded="rounded-lg"
                      className="flex w-full items-center justify-between gap-3 border-0! px-3 py-2 text-left shadow-none ring-0!"
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
                    </Button>
                    {expanded === edit.id ? (
                      <pre className="max-h-96 overflow-auto border-t border-main-700/40 px-3 py-2 text-[11px] leading-5">
                        {renderDiff(edit.diff)}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </section>
            ))}
            {groups.length === 0 ? (
              <p className="py-8 text-center text-xs text-main-500">
                Агент ещё не менял файлы в этом диалоге
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </Modal.Content>
    </Modal>
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
