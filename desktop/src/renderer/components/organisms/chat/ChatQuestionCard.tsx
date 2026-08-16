import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Button, InputSmall } from "@kiyotakkkka/zvs-uikit-lib";
import { questionStore } from "../../../stores";

export const ChatQuestionCard = observer(function ChatQuestionCard() {
  const question = questionStore.current;
  const [selected, setSelected] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");

  useEffect(() => {
    setSelected([]);
    setFreeText("");
  }, [question?.id]);

  if (!question) return null;

  const toggle = (label: string) =>
    setSelected((current) =>
      question.multiSelect
        ? current.includes(label)
          ? current.filter((item) => item !== label)
          : [...current, label]
        : [label],
    );

  const submit = (answer: string[]) => {
    if (!answer.length) return;
    void questionStore.answer(question.id, answer);
  };

  return (
    <section
      aria-label="Вопрос ассистента"
      className="relative w-full overflow-hidden border-b border-main-700/70 bg-main-800/35"
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-px" />

      <div className="border-b border-main-700/40 px-5 pb-3 pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-accent-light">
            <span className="size-1.5 rounded-full bg-accent-medium shadow-[0_0_10px_rgba(183,243,74,0.45)]" />
            {question.header || "Вопрос ассистента"}
          </p>
          {question.multiSelect ? (
            <span className="text-[11px] text-main-500">
              Можно выбрать несколько
            </span>
          ) : null}
        </div>
        <p className="text-[15px] font-medium leading-6 text-main-100">
          {question.question}
        </p>
      </div>

      {question.options.length ? (
        <div className="px-5 py-3.5">
          <div className="flex flex-wrap gap-2">
            {question.options.map((option) => {
              const active = selected.includes(option.label);
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={active}
                  title={option.description}
                  onClick={() =>
                    question.multiSelect
                      ? toggle(option.label)
                      : submit([option.label])
                  }
                  disabled={questionStore.answering}
                  className={`group inline-flex min-h-9 items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13px] leading-5 transition-all duration-200 disabled:cursor-wait disabled:opacity-60 ${
                    active
                      ? "border-accent-medium/50 bg-accent-medium/15 text-main-50 shadow-[0_0_0_1px_rgba(183,243,74,0.08)]"
                      : "border-main-700/70 bg-main-900/45 text-main-200 hover:-translate-y-px hover:border-main-600 hover:bg-main-700/45 hover:text-main-50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-4 shrink-0 place-items-center rounded-full border transition-colors ${
                      active
                        ? "border-accent-medium bg-accent-medium"
                        : "border-main-600 bg-main-800 group-hover:border-main-500"
                    }`}
                  >
                    {active ? (
                      <span className="size-1.5 rounded-full bg-main-900" />
                    ) : null}
                  </span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          {question.multiSelect ? (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-main-700/40 pt-3">
              <span className="text-[11px] text-main-500">
                {selected.length
                  ? `Выбрано: ${selected.length}`
                  : "Выберите подходящие варианты"}
              </span>
              <Button
                disabled={!selected.length}
                loading={questionStore.answering}
                onClick={() => submit(selected)}
                variant="primary"
                rounded="rounded-full"
                className="h-9 px-4 text-xs shadow-none ring-0!"
              >
                Ответить
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <form
          className="flex gap-2 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit([freeText.trim()].filter(Boolean));
          }}
        >
          <InputSmall
            autoFocus
            aria-label="Ответ на вопрос"
            className="min-w-0 flex-1"
            value={freeText}
            placeholder="Ваш ответ"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFreeText(e.target.value)
            }
          />
          <Button
            type="submit"
            disabled={!freeText.trim()}
            loading={questionStore.answering}
            variant="primary"
            rounded="rounded-full"
            className="h-9 px-4 text-xs shadow-none ring-0!"
          >
            Ответить
          </Button>
        </form>
      )}
    </section>
  );
});
