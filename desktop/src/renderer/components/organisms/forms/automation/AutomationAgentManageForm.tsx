import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputBig,
  InputCheckBox,
  InputSmall,
  Select,
  Tabs,
} from "@kiyotakkkka/zvs-uikit-lib";
import type { AutomationAgent } from "../../../../../ipc/contracts";
import type {
  AutomationStatus,
  UpsertAutomationAgentInput,
} from "../../../../../shared/dto";
import {
  automationStore,
  textProviderStore,
  vectorStoreStore,
  terminalPolicyStore,
  directoryPolicyStore,
  memoryStore,
} from "../../../../stores";
import { Field } from "../../../atoms";
import { PrimaryButton } from "../../../atoms/buttons";
import { CompactEntitySelector } from "../../../molecules";

interface AutomationAgentManageFormProps {
  model?: AutomationAgent;
  onSubmit: (input: UpsertAutomationAgentInput) => void | Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
}

type TerminalConfirmationMode = "always" | "risky" | "policy";

const confirmationModeRank: Record<TerminalConfirmationMode, number> = {
  policy: 0,
  risky: 1,
  always: 2,
};

const confirmationModeOptions: Array<{
  value: TerminalConfirmationMode;
  label: string;
}> = [
  { value: "always", label: "Подтверждать каждую команду" },
  { value: "risky", label: "Подтверждать рискованные" },
  { value: "policy", label: "Следовать глобальной политике" },
];

const stricterConfirmationMode = (
  first: TerminalConfirmationMode,
  second: TerminalConfirmationMode,
): TerminalConfirmationMode =>
  confirmationModeRank[first] >= confirmationModeRank[second] ? first : second;

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
    const [activeTab, setActiveTab] = useState<
      "basic" | "storage" | "memory" | "skills" | "directories" | "terminal"
    >("basic");
    const [memoryRead, setMemoryRead] = useState(false);
    const [memoryWrite, setMemoryWrite] = useState(false);
    const [terminalEnabled, setTerminalEnabled] = useState(false);
    const [terminalConfirmationMode, setTerminalConfirmationMode] =
      useState<TerminalConfirmationMode>("always");
    const [terminalTimeout, setTerminalTimeout] = useState("60");
    const [terminalCommands, setTerminalCommands] = useState<
      Record<string, boolean>
    >({});
    const [agentDirectories, setAgentDirectories] = useState<
      Record<string, boolean>
    >({});
    const [skillModel, setSkillModel] = useState<Record<string, boolean>>({});
    const [vectorStoreModel, setVectorStoreModel] = useState<
      Record<string, boolean>
    >({});
    const [retrievalLimit, setRetrievalLimit] = useState("5");
    const vectorSearchEnabled = Boolean(toolModel["vecdb_search"]);
    const terminalToolEnabled = Boolean(toolModel["cmd_exec"]);
    const memorySearchEnabled = Boolean(toolModel["memory_search"]);
    const memorySaveEnabled = Boolean(toolModel["memory_save"]);
    const memoryToolsEnabled = memorySearchEnabled || memorySaveEnabled;
    const availableConfirmationModeOptions = useMemo(() => {
      const globalMode =
        terminalPolicyStore.policy?.confirmationMode ?? "always";
      return confirmationModeOptions.filter(
        ({ value }) =>
          confirmationModeRank[value] >= confirmationModeRank[globalMode],
      );
    }, [terminalPolicyStore.policy?.confirmationMode]);
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
      setSkillModel(
        Object.fromEntries(
          automationStore.skills.map((skill) => [
            String(skill.id),
            model?.allowedSkillIds.includes(skill.id) ?? false,
          ]),
        ),
      );
      const isNewAgent = model === undefined;
      const memoryPolicy = memoryStore.policy;
      setMemoryRead(
        isNewAgent
          ? Boolean(memoryPolicy?.enabled)
          : Boolean(model?.memoryRead),
      );
      setMemoryWrite(
        isNewAgent
          ? Boolean(memoryPolicy?.enabled && memoryPolicy.autosave)
          : Boolean(model?.memoryWrite),
      );
      const globalPolicy = terminalPolicyStore.policy;
      const globalDirectories = directoryPolicyStore.policy;
      const terminalPolicy = model?.terminalPolicy;
      const directoryPolicy = model?.directoryPolicy;
      setTerminalEnabled(
        isNewAgent
          ? (globalPolicy?.enabled ?? false)
          : (terminalPolicy?.enabled ?? false),
      );
      setTerminalConfirmationMode(
        isNewAgent
          ? (globalPolicy?.confirmationMode ?? "always")
          : stricterConfirmationMode(
              globalPolicy?.confirmationMode ?? "always",
              terminalPolicy?.confirmationMode ?? "always",
            ),
      );
      setTerminalTimeout(
        String(
          terminalPolicy?.timeoutSeconds ??
            globalPolicy?.defaultTimeoutSeconds ??
            60,
        ),
      );
      setTerminalCommands(
        Object.fromEntries(
          (globalPolicy?.allowedCommands ?? []).map((command) => [
            command,
            isNewAgent
              ? true
              : (terminalPolicy?.allowedCommands.includes(command) ?? false),
          ]),
        ),
      );
      setAgentDirectories(
        Object.fromEntries(
          (globalDirectories?.grants ?? []).map((grant) => [
            grant.path,
            isNewAgent
              ? true
              : (directoryPolicy?.grants.some(
                  (item) => item.path === grant.path,
                ) ?? false),
          ]),
        ),
      );
    }, [
      model?.id,
      automationStore.initialized,
      textProviderStore.initialized,
      vectorStoreStore.initialized,
      terminalPolicyStore.initialized,
      directoryPolicyStore.initialized,
      memoryStore.initialized,
    ]);

    useEffect(() => {
      if (!vectorSearchEnabled && activeTab === "storage")
        setActiveTab("basic");
      if (!terminalToolEnabled && activeTab === "terminal")
        setActiveTab("basic");
      if (!memoryToolsEnabled && activeTab === "memory") setActiveTab("basic");
    }, [
      activeTab,
      vectorSearchEnabled,
      terminalToolEnabled,
      memoryToolsEnabled,
    ]);

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
        allowedSkillIds: Object.entries(skillModel)
          .filter(([, selected]) => selected)
          .map(([id]) => Number(id)),
        memoryRead:
          memorySearchEnabled &&
          Boolean(memoryStore.policy?.enabled) &&
          memoryRead,
        memoryWrite:
          memorySaveEnabled &&
          Boolean(memoryStore.policy?.enabled && memoryStore.policy.autosave) &&
          memoryWrite,
        retrievalLimit: Math.min(Math.max(Number(retrievalLimit) || 5, 1), 20),
        maxToolCalls: model?.maxToolCalls ?? 20,
        timeoutSeconds: model?.timeoutSeconds ?? 120,
        terminalPolicy: {
          enabled: terminalToolEnabled && terminalEnabled,
          confirmationMode: terminalConfirmationMode,
          timeoutSeconds: Math.min(
            Math.max(Number(terminalTimeout) || 60, 1),
            terminalPolicyStore.policy?.maxTimeoutSeconds ?? 300,
          ),
          allowedCommands: Object.entries(terminalCommands)
            .filter(([, selected]) => selected)
            .map(([id]) => id),
        },
        directoryPolicy: {
          grants: (directoryPolicyStore.policy?.grants ?? [])
            .filter((grant) => agentDirectories[grant.path])
            .map((grant) => ({
              path: grant.path,
              recursive: grant.recursive,
              permissions: [...grant.permissions],
            })),
        },
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
            onChange={(value) =>
              setActiveTab(
                value as
                  | "basic"
                  | "storage"
                  | "memory"
                  | "skills"
                  | "directories"
                  | "terminal",
              )
            }
            options={[
              { value: "basic", label: "Базовые настройки" },

              { value: "skills", label: "Навыки" },
              {
                value: "directories",
                label: "Разрешённые директории",
              },
              {
                value: "storage",
                label: "Работа с хранилищем",
                disabled: !vectorSearchEnabled,
              },
              {
                value: "terminal",
                label: "Работа с терминалом",
                disabled: !terminalToolEnabled,
              },

              {
                value: "memory",
                label: "Работа с памятью",
                disabled: !memoryToolsEnabled,
              },
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
              <CompactEntitySelector
                model={toolModel}
                onModelChange={setToolModel}
                searchPlaceholder="Найти инструмент"
                items={automationStore.tools.map((tool) => ({
                  id: tool.id,
                  title: tool.name,
                  description: tool.description,
                  group: tool.category,
                  meta: tool.enabled ? undefined : "Недоступен",
                  disabled: !tool.enabled,
                }))}
              />
            </FormSection>
          </>
        ) : activeTab === "memory" ? (
          <FormSection
            title="Работа с памятью"
            description="Уточняет глобальную политику памяти для этого агента."
          >
            {!memoryStore.policy?.enabled ? (
              <div className="rounded-lg border border-dashed border-main-700 p-6 text-center text-sm text-main-500">
                Память отключена глобально в разделе «Настройки → Политики →
                Память».
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {memorySearchEnabled ? (
                  <InputCheckBox checked={memoryRead} onChange={setMemoryRead}>
                    Разрешить этому агенту читать память
                  </InputCheckBox>
                ) : null}
                {memorySaveEnabled ? (
                  <InputCheckBox
                    checked={memoryWrite}
                    disabled={!memoryStore.policy.autosave}
                    onChange={setMemoryWrite}
                  >
                    Разрешить этому агенту сохранять записи в память
                  </InputCheckBox>
                ) : null}
                {memorySaveEnabled && !memoryStore.policy.autosave ? (
                  <p className="text-xs leading-5 text-main-500">
                    Самостоятельная запись отключена глобально. Включите её в
                    разделе «Настройки → Политики → Память».
                  </p>
                ) : null}
                <p className="text-xs leading-5 text-main-500">
                  Вкладка доступна, пока у агента включён хотя бы один из
                  инструментов memory_search или memory_save.
                </p>
              </div>
            )}
          </FormSection>
        ) : activeTab === "storage" ? (
          <FormSection
            title="Доступ к базам знаний"
            description="Выберите хранилища, в которых агент сможет выполнять поиск через vecdb_search."
          >
            {vectorStoreStore.stores.length ? (
              <>
                <CompactEntitySelector
                  model={vectorStoreModel}
                  onModelChange={setVectorStoreModel}
                  searchPlaceholder="Найти хранилище"
                  items={vectorStoreStore.stores.map((store) => ({
                    id: String(store.id),
                    title: store.name,
                    description:
                      store.searchMode === "hybrid"
                        ? "Гибридный поиск"
                        : "Векторный поиск",
                    meta: `${vectorDocumentCounts.get(store.id) ?? 0} док.`,
                    disabled: store.status !== "ready",
                  }))}
                />
                <Field label="Количество результатов" className="max-w-xs">
                  <InputSmall
                    type="number"
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
        ) : activeTab === "skills" ? (
          <FormSection
            title="Навыки"
            description="Назначьте агенту переиспользуемые инструкции. Они загружаются по необходимости и не раздувают каждый запрос."
          >
            {automationStore.skills.length ? (
              <CompactEntitySelector
                model={skillModel}
                onModelChange={setSkillModel}
                searchPlaceholder="Найти навык"
                items={automationStore.skills.map((skill) => ({
                  id: String(skill.id),
                  title: skill.name,
                  description: skill.description,
                  meta: skill.builtin ? "Системный" : skill.version,
                  disabled: skill.status !== "active",
                }))}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-main-700 p-6 text-center text-sm text-main-500">
                Сначала создайте навык в разделе «Автоматизация → Навыки».
              </div>
            )}
          </FormSection>
        ) : activeTab === "directories" ? (
          <FormSection
            title="Разрешённые директории"
            description="Уточняет глобальную политику файлового доступа для этого агента."
          >
            {directoryPolicyStore.policy?.grants.length ? (
              <CompactEntitySelector
                model={agentDirectories}
                onModelChange={setAgentDirectories}
                searchPlaceholder="Найти разрешённую директорию"
                items={directoryPolicyStore.policy.grants.map((grant) => ({
                  id: grant.path,
                  title: grant.path,
                  description: grant.permissions.join(", "),
                  group: grant.recursive ? "С вложенными" : "Только директория",
                }))}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-main-700 p-6 text-center text-sm text-main-500">
                Сначала добавьте пути в разделе «Настройки → Политики →
                Разрешённые директории».
              </div>
            )}
          </FormSection>
        ) : (
          <FormSection
            title="Работа с терминалом"
            description="Уточняет глобальную политику для этого агента."
          >
            {!terminalPolicyStore.policy?.enabled ? (
              <div className="rounded-lg border border-dashed border-main-700 p-6 text-center text-sm text-main-500">
                Терминал отключён глобально в разделе «Настройки → Политики».
              </div>
            ) : (
              <>
                <InputCheckBox
                  checked={terminalEnabled}
                  onChange={(state) => setTerminalEnabled(state)}
                >
                  Разрешить этому агенту использовать терминал
                </InputCheckBox>
                <Field label="Подтверждение" className="max-w-md">
                  <Select
                    value={terminalConfirmationMode}
                    onChange={(value) =>
                      setTerminalConfirmationMode(
                        value as TerminalConfirmationMode,
                      )
                    }
                    options={availableConfirmationModeOptions}
                  >
                    <Select.Trigger />
                    <Select.Menu>
                      {availableConfirmationModeOptions.map((option) => (
                        <Select.Option key={option.value} {...option} />
                      ))}
                    </Select.Menu>
                  </Select>
                </Field>
                <Field label="Таймаут команды, сек." className="max-w-xs">
                  <InputSmall
                    type="number"
                    min={1}
                    max={terminalPolicyStore.policy.maxTimeoutSeconds}
                    value={terminalTimeout}
                    onChange={(event) => setTerminalTimeout(event.target.value)}
                  />
                </Field>
                <CompactEntitySelector
                  model={terminalCommands}
                  onModelChange={setTerminalCommands}
                  searchPlaceholder="Найти разрешённую команду"
                  items={terminalPolicyStore.policy.allowedCommands.map(
                    (command) => ({
                      id: command,
                      title: command,
                      description: "Разрешено глобальной политикой",
                      group: "PowerShell",
                    }),
                  )}
                />
              </>
            )}
          </FormSection>
        )}

        <div className="flex justify-end gap-2 border-t border-main-800 pt-5">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <PrimaryButton
            type="submit"
            variant={model ? "save" : "create"}
            loading={submitting}
            disabled={
              submitting ||
              !name.trim() ||
              !description.trim() ||
              !instructions.trim() ||
              !textModelId
            }
            label={model ? "Сохранить" : "Добавить"}
          />
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
