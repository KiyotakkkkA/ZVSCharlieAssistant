import { useEffect, useState, type SubmitEvent } from "react";
import { Button, InputCheckSlided } from "@kiyotakkkka/zvs-uikit-lib";
import { PrimaryButton } from "../../atoms/buttons";

interface ScenarioChatTriggerSetupFormProps {
  model?: boolean;
  onSubmit(enabled: boolean): void;
  onConfirm(): void;
  onCancel(): void;
}

export function ScenarioChatTriggerSetupForm({ model, onSubmit, onConfirm, onCancel }: ScenarioChatTriggerSetupFormProps) {
  const [enabled, setEnabled] = useState(model ?? false);
  useEffect(() => setEnabled(model ?? false), [model]);

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(enabled);
    onConfirm();
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div className="flex items-center justify-between rounded-xl bg-main-800/45 p-4">
        <div><p className="text-sm font-medium text-main-100">Показывать в чате</p><p className="mt-1 text-xs text-main-500">Сценарий появится среди доступных способов запуска в поле сообщения.</p></div>
        <InputCheckSlided checked={enabled} onChange={setEnabled} />
      </div>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Отмена</Button><PrimaryButton type="submit" variant="save" label="Сохранить" /></div>
    </form>
  );
}
