import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputBig,
  InputCheckBox,
  InputCheckBoxGroup,
  InputSmall,
  Select,
  Tabs,
} from "@kiyotakkkka/zvs-uikit-lib";
import type {
  AutomationAgent,
  AutomationStatus,
  UpsertAutomationAgentInput,
} from "../../../../ipc/contracts";
import {
  automationStore,
  textProviderStore,
  vectorStoreStore,
} from "../../../stores";
import { Field } from "../../atoms";
import { PrimaryButton } from "../../atoms/buttons";

interface AutomationAgentManageFormProps {
  model?: AutomationAgent;
  onSubmit: (input: UpsertAutomationAgentInput) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

export const AutomationAgentManageForm = observer(
  function AutomationAgentManageForm({
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
    const [activeTab, setActiveTab] = useState<"basic" | "storage" | "skills">("basic");
    const [skillModel, setSkillModel] = useState<Record<string, boolean>>({});
    const [vectorStoreModel, setVectorStoreModel] = useState<
      Record<string, boolean>
    >({});
    const [retrievalLimit, setRetrievalLimit] = useState("5");
    const vectorSearchEnabled = Boolean(toolModel["vecdb.search"]);
    const vectorDocumentCounts = useMemo(() => {
      const counts = new Map<number, number>();
      for (const document of vectorStoreStore.documents)
        counts.set(
          document.vectorStoreId,
          (counts.get(document.vectorStoreId) ?? 0) + 1,
        );
      return counts;
    }, [vectorStoreStore.documents]);

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
      setVectorStoreModel(
        Object.fromEntries(
          vectorStoreStore.stores.map((store) => [
            String(store.id),
            model?.allowedVectorStoreIds.includes(store.id) ?? false,
          ]),
        ),
      );
      setRetrievalLimit(String(model?.retrievalLimit ?? 5));
      setSkillModel(Object.fromEntries(automationStore.skills.map((skill) => [String(skill.id), model?.allowedSkillIds.includes(skill.id) ?? false])));
    }, [
      model,
      automationStore.initialized,
      textProviderStore.initialized,
      vectorStoreStore.initialized,
    ]);

    useEffect(() => {
      if (!vectorSearchEnabled && activeTab === "storage")
        setActiveTab("basic");
    }, [activeTab, vectorSearchEnabled]);

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
        allowedVectorStoreIds: vectorSearchEnabled
          ? Object.entries(vectorStoreModel)
              .filter(([, selected]) => selected)
              .map(([id]) => Number(id))
          : [],
        allowedSkillIds: Object.entries(skillModel).filter(([, selected]) => selected).map(([id]) => Number(id)),
        retrievalLimit: Math.min(Math.max(Number(retrievalLimit) || 5, 1), 20),
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
        <div className="w-fit">
          <Tabs
            value={activeTab}
            onChange={(value) => setActiveTab(value as "basic" | "storage" | "skills")}
            options={[
              { value: "basic", label: "Базовые настройки" },
              {
                value: "storage",
                label: "Работа с хранилищем",
                disabled: !vectorSearchEnabled,
              },
              { value: "skills", label: "Навыки" },
            ]}
          />
        </div>

        {activeTab === "basic" ? (
          <>
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
              description="Текстовая модель, которая будет использоваться агентом для обработки запросов."
            >
              <Select
                className="w-full"
                value={textModelId}
                onChange={setTextModelId}
                options={textProviderStore.enabledModels.map((item) => ({
                  value: String(item.id),
                  label: textProviderStore.modelLabel(item.id),
                }))}
                placeholder="Выберите модель"
                searchable
              >
                <Select.Trigger />
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
          </>
        ) : activeTab === "storage" ? (
          <FormSection
            title="Доступ к базам знаний"
            description="Выберите хранилища, в которых агент сможет выполнять поиск через vecdb.search."
          >
            {vectorStoreStore.stores.length ? (
              <>
                <InputCheckBoxGroup
                  model={vectorStoreModel}
                  onModelChange={setVectorStoreModel}
                  multiple
                  orientation="vertical"
                  className="grid gap-2 lg:grid-cols-2"
                >
                  {vectorStoreStore.stores.map((store) => (
                    <InputCheckBox
                      key={store.id}
                      modelValue={String(store.id)}
                      disabled={store.status !== "ready"}
                      className="rounded-lg bg-main-800/40 p-3 ring-1 ring-main-700/45"
                    >
                      <span className="block text-sm font-medium text-main-100">
                        {store.name}
                      </span>
                      <span className="mt-1 block text-xs text-main-500">
                        {vectorDocumentCounts.get(store.id) ?? 0} документов ·{" "}
                        {store.searchMode === "hybrid"
                          ? "гибридный поиск"
                          : "векторный поиск"}
                      </span>
                    </InputCheckBox>
                  ))}
                </InputCheckBoxGroup>
                <Field label="Количество результатов" className="max-w-xs">
                  <InputSmall
                    min={1}
                    max={20}
                    value={retrievalLimit}
                    onChange={(event) => setRetrievalLimit(event.target.value)}
                  />
                </Field>
                <p className="text-xs leading-5 text-main-500">
                  Модель сможет выбирать только отмеченные базы. Подключения
                  через порт сценария на эту настройку не влияют.
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-main-700 p-6 text-center text-sm text-main-500">
                Сначала создайте векторное хранилище и настройте
                embedding-модель.
              </div>
            )}
          </FormSection>
        ) : (
          <FormSection title="Навыки" description="Назначьте агенту переиспользуемые инструкции. Они загружаются по необходимости и не раздувают каждый запрос.">
            {automationStore.skills.length ? <InputCheckBoxGroup model={skillModel} onModelChange={setSkillModel} multiple orientation="vertical" className="grid gap-2 lg:grid-cols-2">{automationStore.skills.map((skill) => <InputCheckBox key={skill.id} modelValue={String(skill.id)} disabled={skill.status !== "active"} className="rounded-lg bg-main-800/40 p-3 ring-1 ring-main-700/45"><span><span className="block text-sm font-medium text-main-100">{skill.name}</span><span className="mt-1 block text-xs text-main-500">{skill.description}</span></span></InputCheckBox>)}</InputCheckBoxGroup> : <div className="rounded-lg border border-dashed border-main-700 p-6 text-center text-sm text-main-500">Сначала создайте навык в разделе «Автоматизация → Навыки».</div>}
          </FormSection>
        )}

        <div className="flex justify-end gap-2 border-t border-main-800 pt-5">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <PrimaryButton
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
          ></PrimaryButton>
        </div>
      </form>
    );
  },
);

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
    <section className="grid gap-4 rounded-xl bg-main-800/20 p-5 ring-1 ring-main-700/35 xl:grid-cols-[220px_1fr] ">
      <div>
        <h2 className="text-sm font-semibold text-main-100">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-main-500">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
