import { Button, InputBig } from "@kiyotakkkka/zvs-uikit-lib";
import { memo, useState } from "react";
import { ControlButton } from "../atoms/buttons";

export const ChatUserMsgBlock = memo(function ChatUserMsgBlock({
  text,
  disabled = false,
  onCopy,
  onEdit,
  onDelete,
}: {
  text: string;
  disabled?: boolean;
  onCopy?: () => void;
  onEdit?: (text: string) => void | Promise<void>;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);

  if (editing)
    return (
      <div className="flex justify-end">
        <section className="w-full max-w-2xl rounded-2xl bg-main-700/65 p-2">
          <InputBig
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
            autoResize
            minRows={3}
            maxRows={10}
            classNames={{
              root: "w-full",
              textarea:
                "resize-none border-0 bg-transparent px-2 py-2 text-main-100 shadow-none outline-none ring-0 focus:ring-0 focus:ring-offset-0",
              footer: "hidden",
            }}
          />
          <div className="flex justify-end gap-2 px-1 pb-1">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                setDraft(text);
                setEditing(false);
              }}
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              className="px-2"
              loading={saving}
              disabled={!draft.trim()}
              onClick={() => {
                setSaving(true);
                Promise.resolve(onEdit?.(draft.trim()))
                  .then(() => setEditing(false))
                  .catch(() => undefined)
                  .finally(() => setSaving(false));
              }}
            >
              Отправить
            </Button>
          </div>
        </section>
      </div>
    );
  return (
    <div className="flex justify-end">
      <section className="max-w-[min(75%,42rem)] group space-y-1">
        <div className="rounded-2xl rounded-br-md bg-main-700/65 px-4 py-3 text-[14px] leading-6 text-main-100">
          {text}
        </div>
        <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <ControlButton icon="copy" title="Копировать" onClick={onCopy} />
          <ControlButton
            icon="edit"
            title="Редактировать"
            disabled={disabled}
            onClick={() => setEditing(true)}
          />
          <ControlButton
            variant="delete"
            icon="trash"
            title="Удалить"
            disabled={disabled}
            onClick={onDelete}
          />
        </div>
      </section>
    </div>
  );
});
