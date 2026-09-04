import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  InputCheckBox,
  InputSmall,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { BasicAlert } from "@renderer/components/atoms/basic";
import { memoryStore } from "../../../../stores";
import { Field, ParameterLabel } from "../../../atoms";
import {
  parseIpcDto,
  upsertMemoryPolicyDtoSchema,
  type UpsertMemoryPolicyInput,
} from "../../../../../shared/dto";

export const SettingsMemoryPolicyForm = observer(
  function SettingsMemoryPolicyForm() {
    const toasts = useToasts();
    const policy = memoryStore.policy;
    const [model, setModel] = useState<UpsertMemoryPolicyInput | null>(null);

    useEffect(() => {
      if (policy) {
        const { updatedAt: _updatedAt, ...input } = policy;
        setModel(parseIpcDto(upsertMemoryPolicyDtoSchema, input));
      }
    }, [policy]);

    if (!model) return null;

    const update = <K extends keyof UpsertMemoryPolicyInput>(
      key: K,
      value: UpsertMemoryPolicyInput[K],
    ) =>
      setModel((current) => (current ? { ...current, [key]: value } : current));

    const submit = async (event: React.FormEvent) => {
      event.preventDefault();
      try {
        await memoryStore.savePolicy(model);
        toasts.success({ title: "Политика памяти сохранена" });
      } catch (error) {
        toasts.danger({
          title: "Не удалось сохранить",
          description:
            error instanceof Error ? error.message : "Неизвестная ошибка",
        });
      }
    };

    return (
      <form
        id="settings-memory-policy-form"
        onSubmit={submit}
        className="space-y-6"
      >
        <BasicAlert variant="info" title="Как работает память">
          Ассистент сохраняет факты, предпочтения и указания, которые должны
          пережить отдельный диалог, и подмешивает их в системное сообщение.
          Доступ выдаётся каждому агенту отдельно — в его карточке.
        </BasicAlert>

        <div className="space-y-3 flex flex-col">
          <InputCheckBox
            checked={model.enabled}
            onChange={(state) => update("enabled", state)}
          >
            <ParameterLabel description="Выключение не удаляет записи: агенты просто перестают их читать и сохранять.">
              Память включена
            </ParameterLabel>
          </InputCheckBox>
          <InputCheckBox
            checked={model.autosave}
            onChange={(state) => update("autosave", state)}
          >
            <ParameterLabel description="Без этого агент сможет только искать в памяти, но не пополнять её.">
              Разрешить агентам сохранять записи самостоятельно
            </ParameterLabel>
          </InputCheckBox>
          <InputCheckBox
            checked={model.allowScenarioWrites}
            onChange={(state) => update("allowScenarioWrites", state)}
          >
            <ParameterLabel description="Сценарий запускается входящим письмом или сообщением. Его содержимое пишет посторонний, поэтому запись в память из сценариев по умолчанию запрещена.">
              Разрешить запись из сценариев
            </ParameterLabel>
          </InputCheckBox>
          <p className="text-xs text-main-500">
            Сценарий запускается по внешнему событию — письму или сообщению в
            Telegram. Запись из него отключена по умолчанию, чтобы содержимое
            входящего письма не попадало в память как факт о вас.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label={
              <ParameterLabel description="Когда записей становится больше, вытесняются самые давние. Закреплённые не вытесняются никогда.">
                Лимит незакреплённых записей
              </ParameterLabel>
            }
          >
            <InputSmall
              type="number"
              min={1}
              max={10000}
              value={model.maxEntries}
              onChange={(e) => update("maxEntries", Number(e.target.value))}
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Длинные записи бесполезны: память нужна для коротких устойчивых фактов, а не для пересказа диалогов.">
                Размер записи, символов
              </ParameterLabel>
            }
          >
            <InputSmall
              type="number"
              min={100}
              max={20000}
              value={model.maxContentChars}
              onChange={(e) =>
                update("maxContentChars", Number(e.target.value))
              }
            />
          </Field>
          <Field
            label={
              <ParameterLabel description="Сколько записей подмешивается в системное сообщение каждого запроса. Ноль — не подмешивать вовсе, оставив только поиск инструментом.">
                Записей в контекст
              </ParameterLabel>
            }
          >
            <InputSmall
              type="number"
              min={0}
              max={50}
              value={model.injectedEntries}
              onChange={(e) =>
                update("injectedEntries", Number(e.target.value))
              }
            />
          </Field>
        </div>
      </form>
    );
  },
);
