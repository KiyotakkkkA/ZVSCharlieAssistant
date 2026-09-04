import { useEffect, useState } from "react";
import {
  Button,
  InputSmall,
  Modal,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { entityGenerationStore } from "../../../stores";
import type { EntityGenerationRun } from "../../../../ipc/contracts";

interface Props {
  run: EntityGenerationRun | null;
  onClose: () => void;
}

export function GenerationQuestionModal({ run, onClose }: Props) {
  const toasts = useToasts();
  const question = run?.pendingQuestion ?? null;
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSelected([]);
    setFreeText("");
  }, [question?.id]);

  const toggle = (label: string) =>
    setSelected((current) =>
      question?.multiSelect
        ? current.includes(label)
          ? current.filter((item) => item !== label)
          : [...current, label]
        : [label],
    );

  const submit = async (answer: string[]) => {
    if (!question || !answer.length) return;
    setSubmitting(true);
    try {
      await entityGenerationStore.answerQuestion(question.id, answer);
      onClose();
    } catch (error) {
      toasts.danger({
        title: "Не удалось отправить ответ",
        description:
          error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={run !== null && question !== null}
      rounded="rounded-4xl"
      className="max-w-xl"
      onClose={onClose}
    >
      <Modal.Header>
        <h2 className="text-lg font-semibold text-main-50">
          {question?.header || "Уточнение от модели"}
        </h2>
      </Modal.Header>
      <Modal.Content>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-main-200">
            {question?.question}
          </p>

          {question?.options.length ? (
            <div className="flex flex-wrap gap-2">
              {question.options.map((option) => {
                const active = selected.includes(option.label);
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={active}
                    title={option.description}
                    disabled={submitting}
                    onClick={() =>
                      question.multiSelect
                        ? toggle(option.label)
                        : void submit([option.label])
                    }
                    className={`inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] leading-5 transition-all duration-200 disabled:cursor-wait disabled:opacity-60 ${
                      active
                        ? "border-accent-medium/50 bg-accent-medium/15 text-main-50"
                        : "border-main-700/70 bg-main-900/45 text-main-200 hover:border-main-600 hover:bg-main-700/45"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <InputSmall
              autoFocus
              aria-label="Ответ на вопрос"
              className="w-full"
              value={freeText}
              placeholder="Ваш ответ"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setFreeText(event.target.value)
              }
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Отмена
            </Button>
            {!question?.options.length || question?.multiSelect ? (
              <Button
                variant="primary"
                loading={submitting}
                disabled={
                  question?.options.length ? !selected.length : !freeText.trim()
                }
                onClick={() =>
                  void submit(
                    question?.options.length ? selected : [freeText.trim()],
                  )
                }
              >
                Ответить
              </Button>
            ) : null}
          </div>
        </div>
      </Modal.Content>
    </Modal>
  );
}
