import { useEffect, useState, type SubmitEvent } from "react";
import {
  Button,
  InputCheckBox,
  InputCheckSlided,
  InputSmall,
  ScrollArea,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { ScenarioTriggerConfig } from "../../../../../shared/dto";
import { Field, ParameterLabel } from "../../../atoms";
import { PrimaryButton } from "../../../atoms/buttons";

type IntervalTrigger = Extract<
  ScenarioTriggerConfig["automatic"][number],
  { kind: "interval" }
>;
interface Props {
  model?: IntervalTrigger[];
  onSubmit(value: IntervalTrigger[]): void;
  onConfirm(): void;
  onCancel(): void;
}

export function ScenarioIntervalTriggerSetupForm({
  model,
  onSubmit,
  onConfirm,
  onCancel,
}: Props) {
  const makeDefault = (): IntervalTrigger => ({
    id: crypto.randomUUID(),
    kind: "interval",
    enabled: true,
    intervalSeconds: 3600,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    misfirePolicy: "run_once",
    preventOverlap: true,
  });
  const [items, setItems] = useState<IntervalTrigger[]>(model ?? []);
  useEffect(() => setItems(model?.map((item) => ({ ...item })) ?? []), [model]);
  const patch = (id: string, changes: Partial<IntervalTrigger>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(items);
    onConfirm();
  };
  return (
    <form className="space-y-4" onSubmit={submit}>
      <ScrollArea className="max-h-[55vh] pr-2">
        <div className="space-y-3">
          {items.map((item, index) => (
            <section
              key={item.id}
              className="space-y-4 rounded-xl border border-main-700 bg-main-800/25 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-main-100">
                    Расписание {index + 1}
                  </p>
                  <p className="text-xs text-main-500">
                    Устойчивый периодический запуск сценария.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <InputCheckSlided
                    checked={item.enabled}
                    onChange={(enabled) => patch(item.id, { enabled })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 text-danger-light"
                    onClick={() =>
                      setItems((current) =>
                        current.filter((entry) => entry.id !== item.id),
                      )
                    }
                  >
                    Удалить
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={
                    <ParameterLabel description="Пауза между запусками сценария. Минимальное значение — 60 секунд.">
                      Интервал, секунд
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    type="number"
                    min={60}
                    value={String(item.intervalSeconds)}
                    onChange={(event) =>
                      patch(item.id, {
                        intervalSeconds: Math.max(
                          60,
                          Number(event.target.value) || 60,
                        ),
                      })
                    }
                  />
                </Field>
                <Field
                  label={
                    <ParameterLabel description="Часовой пояс используется при расчёте времени следующих запусков.">
                      Часовой пояс
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    value={item.timezone}
                    onChange={(event) =>
                      patch(item.id, { timezone: event.target.value })
                    }
                  />
                </Field>
              </div>
              <Field
                label={
                  <ParameterLabel description="Определяет, что делать с запуском, пропущенным во время выключенного приложения.">
                    Пропущенные запуски
                  </ParameterLabel>
                }
              >
                <Select
                  value={item.misfirePolicy}
                  onChange={(misfirePolicy) =>
                    patch(item.id, {
                      misfirePolicy:
                        misfirePolicy as IntervalTrigger["misfirePolicy"],
                    })
                  }
                  options={[
                    { value: "skip", label: "Пропустить" },
                    { value: "run_once", label: "Выполнить один раз" },
                    { value: "catch_up", label: "Восстановить все" },
                  ]}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Menu>
                    <Select.Option value="skip" label="Пропустить" />
                    <Select.Option
                      value="run_once"
                      label="Выполнить один раз"
                    />
                    <Select.Option value="catch_up" label="Восстановить все" />
                  </Select.Menu>
                </Select>
              </Field>
              <InputCheckBox
                checked={item.preventOverlap}
                onChange={(preventOverlap) =>
                  patch(item.id, { preventOverlap })
                }
              >
                Не запускать повторно, пока предыдущее выполнение не завершено
              </InputCheckBox>
            </section>
          ))}
          {!items.length ? (
            <div className="rounded-xl border border-dashed border-main-700 p-8 text-center text-sm text-main-500">
              Интервальные запуски ещё не настроены.
            </div>
          ) : null}
        </div>
      </ScrollArea>
      <div className="flex items-center justify-between gap-3">
        <PrimaryButton
          type="button"
          variant="create"
          label="Добавить интервал"
          onClick={() => setItems((current) => [...current, makeDefault()])}
        />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <PrimaryButton type="submit" variant="save" label="Сохранить" />
        </div>
      </div>
    </form>
  );
}
