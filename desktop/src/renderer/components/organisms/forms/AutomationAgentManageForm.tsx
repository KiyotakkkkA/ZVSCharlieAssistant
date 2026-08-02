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
} from "../../../../ipc/contracts";
import {
  automationStore,
  textProviderStore,
} from "../../../stores";
import { CreateButton } from "@renderer/components/atoms/buttons";

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
  const [textModelId, setTextModelId] = useState("");
  const [toolModel, setToolModel] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setName(model?.name ?? "");
    setDescription(model?.description ?? "");
    setInstructions(model?.instructions ?? "");
    setStatus(model?.status ?? "draft");
    setTextModelId(
      model?.textModelId
        ? String(model.textModelId)
        : textProviderStore.enabledModels[0]
          ? String(textProviderStore.enabledModels[0].id)
          : "",
    );
    setToolModel(
      Object.fromEntries(
        automationStore.tools.map((tool) => [
          tool.id,
          model?.allowedToolIds.includes(tool.id) ?? false,
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
    await onSubmit({
      id: model?.id,
      name: name.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      textModelId: Number(textModelId),
      status,
      allowedToolIds: selectedToolIds,
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
        <Field label="Статус" className="w-fit">
          <Select
            className="w-fit"
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
        title="Модель"
        description="Проверенная модель активного провайдера, которая будет выполнять инструкции агента."
      >
        <Select
          value={textModelId}
          onChange={setTextModelId}
          options={textProviderStore.enabledModels.map((item) => ({
            value: String(item.id),
            label: textProviderStore.modelLabel(item.id),
          }))}
          placeholder="Выберите модель"
          searchable
        >
          <Select.Trigger className="w-full" />
          <Select.Menu>
            {textProviderStore.enabledModels.map((item) => (
              <Select.Option
                key={item.id}
                value={String(item.id)}
                label={textProviderStore.modelLabel(item.id)}
              />
            ))}
          </Select.Menu>
        </Select>
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

      <div className="flex justify-end gap-2 border-t border-main-800 pt-5">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <CreateButton
          type="submit"
          loading={submitting}
          disabled={
            submitting ||
            !name.trim() ||
            !description.trim() ||
            !instructions.trim() ||
            !textModelId
          }
          label={model ? "Сохранить" : "Добавить"}
        ></CreateButton>
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
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-medium text-main-400">
        {label}
      </span>
      {children}
    </label>
  );
}
