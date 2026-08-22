import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  InputBig,
  Modal,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { Field, ModelOrientedSelect } from "../../atoms";
import { PrimaryButton } from "../../atoms/buttons";
import { entityGenerationStore, textProviderStore } from "../../../stores";
import type { GeneratedEntityKind } from "../../../../ipc/contracts";

const COPY = {
  agent: {
    title: "Создать агента с помощью модели",
    label: "Опишите агента",
    placeholder:
      "Например: агент, который читает мои рабочие заметки и собирает из них план на неделю с приоритетами.",
    hint: "Модель спроектирует роль, инструкции и подберёт инструменты.",
  },
  skill: {
    title: "Создать навык с помощью модели",
    label: "Опишите навык",
    placeholder:
      "Например: навык, который приводит выгруженные CSV-файлы в порядок — чинит заголовки и типы колонок.",
    hint: "Модель напишет подробную пошаговую инструкцию навыка.",
  },
} as const;

interface Props {
  open: boolean;
  kind: GeneratedEntityKind;
  onClose: () => void;
}

export const AIEntityCreateForm = observer(function AIEntityCreateForm({
  open,
  kind,
  onClose,
}: Props) {
  const toasts = useToasts();
  const copy = COPY[kind];
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!open) return;
    setPrompt("");
    setModelId(
      (current) =>
        current || String(textProviderStore.enabledModels[0]?.id ?? ""),
    );
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await entityGenerationStore.start({
        kind,
        modelId,
        prompt,
      });
      toasts.success({
        title: "Генерация поставлена в очередь",
        description: "Ход выполнения — на странице «Задачи», вкладка «Создание».",
      });
      onClose();
    } catch (error) {
      toasts.danger({
        title: "Не удалось запустить генерацию",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    }
  };

  return (
    <Modal
      open={open}
      rounded="rounded-4xl"
      className="max-w-xl"
      onClose={onClose}
    >
      <Modal.Header>
        <h2 className="text-lg font-semibold text-main-50">{copy.title}</h2>
      </Modal.Header>
      <Modal.Content>
        <form onSubmit={submit} className="space-y-5">
          <Alert variant="info" title="Как это работает">
            {copy.hint} Результат появится в списке со статусом «Черновик» —
            проверьте и доработайте его перед включением.
          </Alert>

          <Field label="Модель">
            <ModelOrientedSelect
              value={modelId}
              onChange={(value) => setModelId(String(value))}
            />
          </Field>

          <InputBig
            label={copy.label}
            description="Чем подробнее описание, тем меньше придётся править результат."
            placeholder={copy.placeholder}
            maxLength={4000}
            showCount
            autoResize
            minRows={5}
            maxRows={14}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            <PrimaryButton
              type="submit"
              variant="create"
              label="Сгенерировать"
              loading={entityGenerationStore.starting}
              disabled={!modelId || prompt.trim().length < 10}
            />
          </div>
        </form>
      </Modal.Content>
    </Modal>
  );
});
