import type { SecretCategory } from "../../../ipc/contracts";
import { FolderIcon } from "../atoms";
import { ControlButton } from "../atoms/basic";

interface StorageSecretCategoryCardProps {
  category: SecretCategory;
  secretsCount: number;
  onEdit: (category: SecretCategory) => void;
  onDelete: (category: SecretCategory) => void;
}

export function StorageSecretCategoryCard({
  category,
  secretsCount,
  onEdit,
  onDelete,
}: StorageSecretCategoryCardProps) {
  return (
    <article className="rounded-xl bg-main-800/30 p-5 ring-1 ring-main-700/40 transition-colors hover:bg-main-800/50 hover:ring-main-600">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light">
          <FolderIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-main-100">
            {category.label}
          </h2>
          <p className="mt-2 text-sm text-main-400">{secretsCount} секретов</p>
        </div>
        {category.builtin ? null : (
          <div className="flex">
            <ControlButton
              icon="edit"
              title="Изменить"
              onClick={() => onEdit(category)}
            />
            <ControlButton
              icon="trash"
              title="Удалить"
              variant="delete"
              onClick={() => onDelete(category)}
            />
          </div>
        )}
      </div>
      <div className="mt-5 border-t border-main-700/40 pt-4">
        <span className="rounded-full bg-main-700/60 px-2 py-1 text-xs text-main-300">
          {category.builtin ? "Системная" : "Пользовательская"}
        </span>
      </div>
    </article>
  );
}
