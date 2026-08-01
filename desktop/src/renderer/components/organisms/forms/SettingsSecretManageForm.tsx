import { useEffect, useMemo, useState, type SubmitEvent } from "react";
import {
  Button,
  InputSmall,
  Select,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  SecretCategory,
  SecretEntity,
  UpsertSecretInput,
} from "../../../../ipc/contracts";
import { CreateButton } from "@renderer/components/atoms/buttons";

interface SettingsSecretManageFormProps {
  categories: SecretCategory[];
  model?: SecretEntity;
  onCancel: () => void;
  onConfirm: () => void;
  onSubmit: (input: UpsertSecretInput) => Promise<SecretEntity>;
}

export function SettingsSecretManageForm({
  categories,
  model,
  onCancel,
  onConfirm,
  onSubmit,
}: SettingsSecretManageFormProps) {
  const toasts = useToasts();
  const [label, setLabel] = useState(model?.label ?? "");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(
    String(model?.categoryId ?? categories[0]?.id ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const options = useMemo(
    () =>
      categories.map((category) => ({
        value: String(category.id),
        label: category.label,
      })),
    [categories],
  );

  useEffect(() => {
    setLabel(model?.label ?? "");
    setContent("");
    setCategoryId(String(model?.categoryId ?? categories[0]?.id ?? ""));
  }, [categories, model]);

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        id: model?.id,
        categoryId: Number(categoryId),
        label,
        content: content.trim() || undefined,
      });
      toasts.success({ title: model ? "Секрет обновлён" : "Секрет создан" });
      onConfirm();
    } catch (error) {
      toasts.danger({
        title: "Не удалось сохранить секрет",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <label className="grid gap-2 text-sm text-main-200">
        Название
        <InputSmall
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Введите название секрета..."
          maxLength={120}
          autoFocus
          required
        />
      </label>

      <div className="grid gap-2 text-sm text-main-200">
        Категория
        <Select
          value={categoryId}
          onChange={setCategoryId}
          options={options}
          placeholder="Выберите категорию"
          searchable
        >
          <Select.Trigger className="w-full" />
          <Select.Menu>
            {options.map((option) => (
              <Select.Option key={option.value} {...option} />
            ))}
          </Select.Menu>
        </Select>
      </div>

      <label className="grid gap-2 text-sm text-main-200">
        Содержимое
        <InputSmall
          preset="password"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={model ? "Оставьте пустым, чтобы сохранить текущее значение" : "Введите секретное значение"}
          autoComplete="off"
          required={!model}
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <CreateButton
          type="submit"
          loading={saving}
          disabled={!categoryId}
          label={model ? "Сохранить" : "Добавить"}
        />
      </div>
    </form>
  );
}
