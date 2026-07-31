import { useEffect, useMemo, useState } from "react";
import {
  Button,
  InputBig,
  InputCheckBox,
  InputCheckBoxGroup,
  InputSmall,
  Select,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  AutomationAgent,
  AutomationStatus,
  UpsertAutomationAgentInput,
} from "../../../domains/automation/models";
import { automationStore, secretStorageStore } from "../../../stores";

interface AutomationAgentManageFormProps {
  model?: AutomationAgent;
  onSubmit: (input: UpsertAutomationAgentInput) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export function AutomationAgentManageForm({
  model,
  onSubmit,
  onCancel,
  submitting = false,
}: AutomationAgentManageFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<AutomationStatus>("draft");
  const [toolModel, setToolModel] = useState<Record<string, boolean>>({});
  const [secretModel, setSecretModel] = useState<Record<string, boolean>>({});
  const [requireConfirmation, setRequireConfirmation] = useState(true);

  useEffect(() => {
    setName(model?.name ?? "");
    setDescription(model?.description ?? "");
    setInstructions(model?.instructions ?? "");
    setStatus(model?.status ?? "draft");
    setRequireConfirmation(model?.requireDangerousActionConfirmation ?? true);
    setToolModel(
      Object.fromEntries(
        automationStore.tools.map((tool) => [
          tool.id,
          model?.allowedToolIds.includes(tool.id) ?? false,
        ]),
      ),
    );
    setSecretModel(
      Object.fromEntries(
        secretStorageStore.secrets.map((secret) => [
          String(secret.id),
          model?.secretBindings.some(
            (binding) => binding.secretId === secret.id,
          ) ?? false,
        ]),
      ),
    );
  }, [model]);

  const selectedToolIds = useMemo(
    () =>
      Object.entries(toolModel)
        .filter(([, selected]) => selected)
        .map(([toolId]) => toolId),
    [toolModel],
  );

  const submit = async () => {
    const selectedSecretIds = Object.entries(secretModel)
      .filter(([, selected]) => selected)
      .map(([secretId]) => Number(secretId));

    await onSubmit({
      id: model?.id,
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      model: model?.model ?? "local-default",
      status,
      allowedToolIds: selectedToolIds,
      secretBindings: selectedSecretIds.map((secretId) => ({
        secretId,
        allowedToolIds: selectedToolIds,
      })),
      requireDangerousActionConfirmation: requireConfirmation,
      maxToolCalls: model?.maxToolCalls ?? 20,
      timeoutSeconds: model?.timeoutSeconds ?? 120,
    });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FormSection
        title="Основное"
        description="Название и назначение агента в сценариях автоматизации."
      >
        <Field label="Название">
          <InputSmall
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Например, Исследователь"
            required
          />
        </Field>
        <Field label="Описание">
          <InputSmall
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Кратко опишите область ответственности"
            required
          />
        </Field>
        <Field label="Статус">
          <Select
            value={status}
            onChange={(value) => setStatus(value as AutomationStatus)}
            options={[
              { value: "draft", label: "Черновик" },
              { value: "active", label: "Активен" },
              { value: "disabled", label: "Отключён" },
            ]}
          >
            <Select.Trigger className="w-full" />
            <Select.Menu>
              <Select.Option value="draft" label="Черновик" />
              <Select.Option value="active" label="Активен" />
              <Select.Option value="disabled" label="Отключён" />
            </Select.Menu>
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title="Инструкции"
        description="Системные правила, роль и ограничения поведения модели."
      >
        <InputBig
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          minRows={7}
          maxRows={14}
          autoResize
          showCount
          placeholder="Опишите роль агента, порядок работы и критерии готового результата..."
          required
        />
      </FormSection>

      <FormSection
        title="Инструменты"
        description="Только выбранные возможности будут доступны агенту во время выполнения."
      >
        <InputCheckBoxGroup
          model={toolModel}
          onModelChange={setToolModel}
          multiple
          orientation="vertical"
          className="grid gap-2 lg:grid-cols-2"
        >
          {automationStore.tools.map((tool) => (
            <InputCheckBox
              key={tool.id}
              modelValue={tool.id}
              disabled={!tool.enabled}
              className="rounded-lg bg-main-800/40 p-3 ring-1 ring-main-700/45"
            >
              <span className="block">
                <span className="block text-sm font-medium text-main-100">
                  {tool.name}
                </span>
                <span className="mt-1 block text-xs text-main-500">
                  {tool.category}
                </span>
              </span>
            </InputCheckBox>
          ))}
        </InputCheckBoxGroup>
      </FormSection>

      <FormSection
        title="Секреты"
        description="Значение секрета получает только executor разрешённого инструмента; оно не добавляется в контекст модели."
      >
        {secretStorageStore.secrets.length ? (
          <InputCheckBoxGroup
            model={secretModel}
            onModelChange={setSecretModel}
            multiple
            orientation="vertical"
            className="grid gap-2 lg:grid-cols-2"
          >
            {secretStorageStore.secrets.map((secret) => (
              <InputCheckBox
                key={secret.id}
                modelValue={String(secret.id)}
                className="rounded-lg bg-main-800/40 p-3 ring-1 ring-main-700/45"
              >
                <span className="block">
                  <span className="block text-sm font-medium text-main-100">
                    {secret.label}
                  </span>
                  <span className="mt-1 block text-xs text-main-500">
                    {secretStorageStore.categoryLabel(secret.categoryId)}
                  </span>
                </span>
              </InputCheckBox>
            ))}
          </InputCheckBoxGroup>
        ) : (
          <p className="rounded-lg bg-main-800/35 p-4 text-sm text-main-500">
            В хранилище пока нет секретов.
          </p>
        )}
      </FormSection>

      <FormSection
        title="Безопасность"
        description="Опасные действия должны быть подтверждены пользователем."
      >
        <InputCheckBox
          checked={requireConfirmation}
          onChange={setRequireConfirmation}
        >
          Запрашивать подтверждение потенциально опасных действий
        </InputCheckBox>
      </FormSection>

      <div className="flex justify-end gap-2 border-t border-main-800 pt-5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={
            submitting ||
            !name.trim() ||
            !description.trim() ||
            !instructions.trim()
          }
        >
          {submitting
            ? "Сохранение…"
            : model
              ? "Сохранить изменения"
              : "Создать агента"}
        </Button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35 xl:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-sm font-semibold text-main-100">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-main-500">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-main-400">
        {label}
      </span>
      {children}
    </label>
  );
}
