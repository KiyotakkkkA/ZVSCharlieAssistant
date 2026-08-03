import { Button, Modal } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect, useState, type ReactNode } from "react";

interface DangerModalProps<TModel> {
  open: boolean;
  model: TModel | null | undefined;
  title: ReactNode;
  description: ReactNode | ((model: TModel) => ReactNode);
  onConfirm: (model: TModel) => void | Promise<void>;
  onCancel: () => void;
  confirmLabel?: string;
  className?: string;
}

export function DangerModal<TModel>({
  open,
  model,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Удалить",
  className = "max-w-xl",
}: DangerModalProps<TModel>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  const confirm = async () => {
    if (model == null) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(model);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось выполнить действие",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      rounded="rounded-4xl"
      onClose={loading ? () => undefined : onCancel}
      closeOnOverlayClick={!loading}
      className={className}
    >
      <Modal.Header showCloseButton={!loading}>
        <h2 className="text-lg font-semibold text-main-50">{title}</h2>
      </Modal.Header>
      <Modal.Content>
        <div className="space-y-5">
          <div className="text-sm leading-6 text-main-400">
            {typeof description === "function"
              ? model != null
                ? description(model)
                : null
              : description}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger-light">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={loading} onClick={onCancel}>
              Отмена
            </Button>
            <Button
              variant="danger"
              className="px-3"
              loading={loading}
              onClick={() => void confirm()}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Modal.Content>
    </Modal>
  );
}
