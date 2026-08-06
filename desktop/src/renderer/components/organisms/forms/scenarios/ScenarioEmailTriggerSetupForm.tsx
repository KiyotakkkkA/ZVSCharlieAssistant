import { useEffect, useState, type SubmitEvent } from "react";
import {
  Button,
  InputCheckBox,
  InputCheckSlided,
  InputSmall,
  ScrollArea,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { IntegrationProfile } from "../../../../../shared/models/integration";
import type { ScenarioTriggerConfig } from "../../../../../shared/dto";
import { Field, ParameterLabel } from "../../../atoms";
import { PrimaryButton } from "../../../atoms/buttons";

type EmailTrigger = Extract<
  ScenarioTriggerConfig["automatic"][number],
  { kind: "email" }
>;
interface Props {
  model?: EmailTrigger[];
  profiles: IntegrationProfile[];
  onSubmit(value: EmailTrigger[]): void;
  onConfirm(): void;
  onCancel(): void;
}

export function ScenarioEmailTriggerSetupForm({
  model,
  profiles,
  onSubmit,
  onConfirm,
  onCancel,
}: Props) {
  const makeDefault = (): EmailTrigger => ({
    id: crypto.randomUUID(),
    kind: "email",
    enabled: true,
    integrationProfileId: profiles[0]?.id ?? 0,
    mailbox: "INBOX",
    from: "",
    subjectContains: "",
    unreadOnly: true,
    includeAttachments: true,
  });
  const [items, setItems] = useState<EmailTrigger[]>(model ?? []);
  useEffect(() => setItems(model?.map((item) => ({ ...item })) ?? []), [model]);
  const patch = (id: string, changes: Partial<EmailTrigger>) =>
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
                    Почтовый профиль {index + 1}
                  </p>
                  <p className="text-xs text-main-500">
                    Фильтры писем для отдельного IMAP-подключения.
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
                  <ParameterLabel description="Сохранённое IMAP-подключение, в котором приложение проверяет новые письма.">
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
                    <ParameterLabel description="IMAP-папка, которую нужно отслеживать.">
                      Папка
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    value={item.mailbox}
                    onChange={(event) =>
                      patch(item.id, { mailbox: event.target.value })
                    }
                  />
                </Field>
                <Field
                  label={
                    <ParameterLabel description="Необязательный фильтр по адресу отправителя.">
                      Отправитель
                    </ParameterLabel>
                  }
                >
                  <InputSmall
                    value={item.from}
                    onChange={(event) =>
                      patch(item.id, { from: event.target.value })
                    }
                    placeholder="name@example.com"
                  />
                </Field>
              </div>
              <Field
                label={
                  <ParameterLabel description="Сценарий запускается, если тема письма содержит указанный текст.">
                    Тема содержит
                  </ParameterLabel>
                }
              >
                <InputSmall
                  value={item.subjectContains}
                  onChange={(event) =>
                    patch(item.id, { subjectContains: event.target.value })
                  }
                />
              </Field>
              <div className="flex flex-wrap gap-4">
                <InputCheckBox
                  checked={item.unreadOnly}
                  onChange={(unreadOnly) => patch(item.id, { unreadOnly })}
                >
                  Только непрочитанные
                </InputCheckBox>
                <InputCheckBox
                  checked={item.includeAttachments}
                  onChange={(includeAttachments) =>
                    patch(item.id, { includeAttachments })
                  }
                >
                  Передавать вложения
                </InputCheckBox>
              </div>
            </section>
          ))}
          {!items.length ? (
            <div className="rounded-xl border border-dashed border-main-700 p-8 text-center text-sm text-main-500">
              Почтовые триггеры ещё не настроены.
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
