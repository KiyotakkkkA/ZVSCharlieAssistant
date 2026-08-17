import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Modal, ScrollArea } from "@kiyotakkkka/zvs-uikit-lib";
import type { MemoryEntry } from "../../../../ipc/contracts";
import { BrainIcon } from "../../atoms";
import { ControlButton } from "../../atoms/buttons";
import { memoryStore } from "../../../stores";
import { DangerModal } from "../modals";

const KIND_LABELS: Record<MemoryEntry["kind"], string> = {
  fact: "Факт",
  preference: "Предпочтение",
  instruction: "Указание",
  episode: "Событие",
};

interface ChatMemoryModalProps {
  open: boolean;
  onClose: () => void;
}

export const ChatMemoryModal = observer(function ChatMemoryModal({
  open,
  onClose,
}: ChatMemoryModalProps) {
  const [entryToDelete, setEntryToDelete] = useState<MemoryEntry | null>(null);

  return (
    <>
      <Modal
        open={open}
        rounded="rounded-4xl"
        className="max-w-2xl"
        onClose={onClose}
      >
        <Modal.Header>
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
              <BrainIcon className="size-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-main-50">Память</h2>
              <p className="mt-0.5 text-xs text-main-500">
                {memoryStore.total
                  ? `${memoryStore.total} сохранённых записей`
                  : "Сохранённых записей пока нет"}
              </p>
            </div>
          </div>
        </Modal.Header>
        <Modal.Content className="p-0!">
          {memoryStore.entries.length ? (
            <ScrollArea className="max-h-[min(34rem,70vh)]">
              <ul className="divide-y divide-main-700/40">
                {memoryStore.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="group/memory flex items-start gap-3 px-5 py-4 transition-colors hover:bg-main-800/35"
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-main-800/70 text-main-400 ring-1 ring-main-700/40">
                      <BrainIcon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-accent-medium/10 px-1.5 py-0.5 text-[10px] font-medium text-accent-light">
                          {KIND_LABELS[entry.kind]}
                        </span>
                        <h3 className="truncate text-sm font-medium text-main-100">
                          {humanizeTitle(entry.title)}
                        </h3>
                      </div>
                      <p className="mt-1.5 text-xs leading-5 text-main-400">
                        {entry.content}
                      </p>
                      {entry.tags.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-main-800 px-1.5 py-0.5 text-[10px] text-main-500"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={
                          entry.pinned ? "Открепить запись" : "Закрепить запись"
                        }
                        title={entry.pinned ? "Открепить" : "Закрепить"}
                        className={`grid size-8 place-items-center rounded-lg text-sm transition-colors hover:bg-main-700/50 ${entry.pinned ? "text-accent-light" : "text-main-500"}`}
                        onClick={() =>
                          void memoryStore.setPinned(entry.id, !entry.pinned)
                        }
                      >
                        {entry.pinned ? "★" : "☆"}
                      </button>
                      <ControlButton
                        icon="trash"
                        variant="delete"
                        title="Удалить запись"
                        onClick={() => setEntryToDelete(entry)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-main-800/60 text-main-500">
                <BrainIcon className="size-6" />
              </span>
              <p className="mt-4 text-sm font-medium text-main-300">
                Память пока пуста
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-main-500">
                Здесь появятся факты, предпочтения и указания, сохранённые
                агентами во время диалогов.
              </p>
            </div>
          )}
        </Modal.Content>
      </Modal>

      <DangerModal
        open={entryToDelete !== null}
        model={entryToDelete}
        title="Удалить запись из памяти?"
        description={(entry) => (
          <>
            Запись «
            <strong className="font-medium text-main-100">
              {humanizeTitle(entry.title)}
            </strong>
            » будет удалена без возможности восстановления.
          </>
        )}
        onCancel={() => setEntryToDelete(null)}
        onConfirm={async (entry) => {
          await memoryStore.remove(entry.id);
          setEntryToDelete(null);
        }}
      />
    </>
  );
});

function humanizeTitle(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
