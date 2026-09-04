import { Button, InputBig } from "@kiyotakkkka/zvs-uikit-lib";
import { memo, useState } from "react";
import { ControlButton } from "../atoms/basic";
import { FileIcon } from "../atoms";
import type { ChatAttachmentPart } from "../../../shared/dto";
import { formatBytes } from "@renderer/lib/format";

export const ChatUserMsgBlock = memo(function ChatUserMsgBlock({
  text,
  attachments = [],
  disabled = false,
  showControls = true,
  onCopy,
  onEdit,
  onDelete,
}: {
  text: string;
  attachments?: ChatAttachmentPart[];
  disabled?: boolean;
  showControls?: boolean;
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
        {attachments.length ? (
          <div className="flex flex-wrap justify-end gap-2 pb-1">
            {attachments.map((attachment, index) => (
              <div
                key={`${attachment.fileName}:${attachment.size}:${index}`}
                className="flex min-w-56 max-w-80 items-center gap-3 rounded-2xl border border-main-600/45 bg-main-800/90 px-3 py-2.5 shadow-sm"
                title={attachment.fileName}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
                  <FileIcon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-main-100">
                    {attachment.fileName}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-main-500">
                    {attachmentLabel(attachment)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="rounded-2xl rounded-br-md bg-main-700/65 px-4 py-3 text-[14px] leading-6 text-main-100">
          {text}
        </div>
        {showControls ? (
          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
        ) : null}
      </section>
    </div>
  );
});

function attachmentLabel(attachment: ChatAttachmentPart): string {
  const extension = attachment.fileName.split(".").at(-1)?.toUpperCase();
  const type = extension || attachment.mimeType || "Файл";
  return `${type} · ${formatBytes(attachment.size)}`;
}
