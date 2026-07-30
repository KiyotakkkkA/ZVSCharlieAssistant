import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  InputSmall,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  SecretCategory,
  UpsertSecretCategoryInput,
} from "../../../../ipc/contracts";

interface SettingsSecretCategoryManageFormProps {
  model?: SecretCategory;
  onCancel: () => void;
  onSaved: () => void;
  onSubmit: (input: UpsertSecretCategoryInput) => Promise<SecretCategory>;
}

export function SettingsSecretCategoryManageForm({
  model,
  onCancel,
  onSaved,
  onSubmit,
}: SettingsSecretCategoryManageFormProps) {
  const toasts = useToasts();
  const [label, setLabel] = useState(model?.label ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setLabel(model?.label ?? ""), [model]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({ id: model?.id, label });
      toasts.success({
        title: model ? "Категория обновлена" : "Категория создана",
      });
      onSaved();
    } catch (error) {
      toasts.danger({
        title: "Не удалось сохранить категорию",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <label className="grid gap-2 text-sm text-main-200">
        Название категории
        <InputSmall
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Например, API-ключи"
          maxLength={120}
          autoFocus
          required
        />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          {model ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </form>
  );
}
