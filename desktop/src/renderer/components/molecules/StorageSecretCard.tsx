import type { SecretEntity } from "../../../ipc/contracts";
import { KeyIcon } from "../atoms";
import { ControlButton } from "../atoms/buttons";

interface StorageSecretCardProps {
  secret: SecretEntity;
  categoryLabel: string;
  onCopy: (secret: SecretEntity) => void;
  onEdit: (secret: SecretEntity) => void;
  onDelete: (secret: SecretEntity) => void;
}

export function StorageSecretCard({ secret, categoryLabel, onCopy, onEdit, onDelete }: StorageSecretCardProps) {
  return (
    <article className="rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-main-700/50 text-main-200"><KeyIcon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-main-100">{secret.label}</h2>
          <p className="mt-2 text-sm text-main-400">{categoryLabel}</p>
          <p className="mt-2 font-mono text-sm tracking-widest text-main-500">••••••••••••</p>
        </div>
        <div className="flex">
          <ControlButton icon="copy" title="Скопировать" onClick={() => onCopy(secret)} />
          <ControlButton icon="edit" title="Изменить" onClick={() => onEdit(secret)} />
          <ControlButton icon="trash" title="Удалить" variant="delete" onClick={() => onDelete(secret)} />
        </div>
      </div>
      <div className="mt-5 border-t border-main-700/40 pt-4">
        <span className="rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">{secret.builtin ? "Системный" : "Пользовательский"}</span>
      </div>
    </article>
  );
}
