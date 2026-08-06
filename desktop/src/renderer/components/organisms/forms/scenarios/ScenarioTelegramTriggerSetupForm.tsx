import { useEffect, useState, type SubmitEvent } from "react";
import {
  Button,
  InputCheckBox,
  InputCheckSlided,
  InputSmall,
  ScrollArea,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import { Field, ParameterLabel } from "@renderer/components/atoms";
import { PrimaryButton } from "@renderer/components/atoms/buttons";
import { ScenarioTriggerConfig } from "src/shared/dto";
import { IntegrationProfile } from "src/shared/models/integration";

type TelegramTrigger = Extract<
  ScenarioTriggerConfig["automatic"][number],
  { kind: "telegram" }
>;
interface Props {
  model?: TelegramTrigger[];
  profiles: IntegrationProfile[];
  onSubmit(value: TelegramTrigger[]): void;
  onConfirm(): void;
  onCancel(): void;
}

export function ScenarioTelegramTriggerSetupForm({
  model,
  profiles,
  onSubmit,
  onConfirm,
  onCancel,
}: Props) {
  const makeDefault = (): TelegramTrigger => ({
    id: crypto.randomUUID(),
    kind: "telegram",
    enabled: true,
    integrationProfileId: profiles[0]?.id ?? 0,
    allowedChatIds: [],
    command: "",
    includeAttachments: true,
  });
  const [items, setItems] = useState<TelegramTrigger[]>(model ?? []);
  useEffect(() => setItems(model?.map((item) => ({ ...item })) ?? []), [model]);
  const patch = (id: string, changes: Partial<TelegramTrigger>) =>
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
                    Telegram-профиль {index + 1}
                  </p>
                  <p className="text-xs text-main-500">
                    Отдельные фильтры запуска для выбранного бота.
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
              <Field
                label={
                  <ParameterLabel description="Сохранённое подключение Telegram-бота, от которого приложение получает сообщения.">
                    Профиль интеграции
                  </ParameterLabel>
                }
              >
                <Select
                  value={String(item.integrationProfileId || "")}
                  onChange={(id) =>
                    patch(item.id, { integrationProfileId: Number(id) })
                  }
                  options={profiles.map((profile) => ({
                    value: String(profile.id),
                    label: profile.name,
                  }))}
                >
                  <Select.Trigger className="w-full" />
                  <Select.Menu>
                    {profiles.map((profile) => (
                      <Select.Option
                        key={profile.id}
                        value={String(profile.id)}
                        label={profile.name}
                      />
                    ))}
                  </Select.Menu>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={
                    <ParameterLabel description="Необязательный список Telegram chat id через запятую. Пустое поле разрешает сообщения из любого чата.">
                      Разрешённые чаты
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    value={item.allowedChatIds.join(", ")}
                    onChange={(event) =>
                      patch(item.id, {
                        allowedChatIds: event.target.value
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="123456, -100123456"
                  />
                </Field>
                <Field
                  label={
                    <ParameterLabel description="Если команда задана, сценарий запускается только сообщением с этой командой.">
                      Команда
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    value={item.command}
                    onChange={(event) =>
                      patch(item.id, { command: event.target.value })
                    }
                    placeholder="/report"
                  />
                </Field>
              </div>
              <InputCheckBox
                checked={item.includeAttachments}
                onChange={(includeAttachments) =>
                  patch(item.id, { includeAttachments })
                }
              >
                Передавать вложения в сценарий
              </InputCheckBox>
            </section>
          ))}
          {!items.length ? (
            <div className="rounded-xl border border-dashed border-main-700 p-8 text-center text-sm text-main-500">
              Telegram-триггеры ещё не настроены.
            </div>
          ) : null}
        </div>
      </ScrollArea>
      <div className="flex items-center justify-between gap-3">
        <PrimaryButton
          type="button"
          variant="create"
          label="Добавить профиль"
          disabled={!profiles.length}
          onClick={() => setItems((current) => [...current, makeDefault()])}
        />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <PrimaryButton
            type="submit"
            variant="save"
            label="Сохранить"
            disabled={items.some((item) => !item.integrationProfileId)}
          />
        </div>
      </div>
    </form>
  );
}
