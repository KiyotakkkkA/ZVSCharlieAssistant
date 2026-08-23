import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Alert,
  Button,
  InputSmall,
  Modal,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import { useNavigate } from "react-router-dom";
import { APP_PATHS } from "../../app/routes";
import {
  ChatComposer,
  ChatFeed,
  ChatMemoryModal,
  ChatQuestionCard,
  ChatSidebar,
  ChatTaskPanel,
  type ChatDialog,
  type ChatMode,
  type ChatModel,
} from "../../components/organisms/chat";
import {
  automationStore,
  chatStore,
  memoryStore,
  questionStore,
  taskPlanStore,
  textProviderStore,
} from "../../stores";
import { BrainIcon } from "@renderer/components/atoms";
import { PrimaryButton } from "@renderer/components/atoms/buttons";
import { DangerModal } from "@renderer/components/organisms/modals";
import type { StartRunInput } from "../../../shared/dto";

export const ChatPage = observer(function ChatPage() {
  const toasts = useToasts();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [model, setModel] = useState<ChatModel>("");
  const [agentId, setAgentId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [query, setQuery] = useState("");
  const [dialogToEdit, setDialogToEdit] = useState<ChatDialog | null>(null);
  const [dialogToDelete, setDialogToDelete] = useState<ChatDialog | null>(null);
  const [dialogTitle, setDialogTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const nextModelOptions = textProviderStore.enabledModels.map((item) => ({
    value: String(item.id),
  }));
  const nextAgentOptions = automationStore.agents.map((agent) => ({
    value: agent.id,
    label: agent.name,
    description: agent.textModelId
      ? textProviderStore.modelLabel(agent.textModelId)
      : "Модель не настроена",
  }));
  const nextScenarioOptions = automationStore.scenarios
    .filter((scenario) => {
      if (scenario.status !== "active") return false;
      return scenario.graph.nodes.some(
        (node) =>
          node.kind === "trigger.manual" &&
          !node.disabled &&
          (node.config as { fromChat?: boolean }).fromChat !== false,
      );
    })
    .map((scenario) => ({ value: scenario.id, label: scenario.name }));
  const modelOptions = useStableOptions(nextModelOptions);
  const agentOptions = useStableOptions(nextAgentOptions);
  const scenarioOptions = useStableOptions(nextScenarioOptions);
  useEffect(() => {
    if (!modelOptions.some((item) => item.value === model))
      setModel(modelOptions[0]?.value ?? "");
  }, [model, modelOptions]);
  useEffect(() => {
    if (!agentId && agentOptions[0]) setAgentId(agentOptions[0].value);
  }, [agentId, agentOptions]);
  useEffect(() => {
    if (!scenarioOptions.some((item) => item.value === scenarioId))
      setScenarioId(scenarioOptions[0]?.value ?? "");
  }, [scenarioId, scenarioOptions]);
  useEffect(() => {
    void taskPlanStore.load(chatStore.activeConversationId);
    void questionStore.load(chatStore.activeConversationId);
  }, [chatStore.activeConversationId, chatStore.activeRunId]);
  const dialogs = useMemo(
    () =>
      chatStore.conversations
        .filter((item) =>
          item.title
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
        )
        .map((item) => ({
          id: String(item.id),
          title: item.title,
          date: new Date(item.updatedAt).toLocaleDateString("ru-RU"),
        })),
    [query, chatStore.conversations],
  );
  const active = chatStore.conversations.find(
    (item) => item.id === chatStore.activeConversationId,
  );
  useEffect(() => {
    if (!active) return;
    const usage = active.lastUsage;
    setMode(usage.mode);
    if (usage.modelId) setModel(String(usage.modelId));
    if (usage.agentId) setAgentId(usage.agentId);
    if (usage.scenarioId) setScenarioId(usage.scenarioId);
  }, [active?.id, active?.lastUsage]);
  const selectedAgent = automationStore.agents.find(
    (agent) => agent.id === agentId,
  );
  const startMessage = async (
    value: string,
    runOptions: Omit<StartRunInput, "conversationId" | "text"> = {
      mode,
      modelId:
        mode === "agent"
          ? (selectedAgent?.textModelId ?? undefined)
          : mode === "chat" || mode === "planner"
            ? model
            : undefined,
      agentId: mode === "agent" ? agentId : undefined,
      scenarioId: mode === "scenario" ? scenarioId : undefined,
    },
  ) => {
    if (!value) throw new Error("Сообщение не может быть пустым");
    if (runOptions.mode !== "scenario" && !runOptions.modelId)
      throw new Error(
        runOptions.mode === "agent"
          ? "Для выбранного агента не настроена модель"
          : "Модель не выбрана",
      );
    if (chatStore.activeRunId)
      throw new Error("Дождитесь завершения текущего ответа");
    await chatStore.start({
      ...runOptions,
      text: value,
    });
  };
  const send = () => {
    const value = text.trim();
    if (!value) return;
    if (mode !== "scenario" && textProviderStore.enabledModels.length === 0) {
      toasts.warning({
        title: "Не подключена ни одна модель",
        description: "Настройте провайдера и включите модель для отправки сообщения.",
      });
      return;
    }
    setText("");
    void startMessage(value).catch((error: unknown) => {
      setText(value);
      toasts.danger({
        title:
          mode === "scenario"
            ? "Не удалось запустить сценарий"
            : "Не удалось отправить сообщение",
        description: readableError(error),
      });
    });
  };
  return (
    <section data-tour="chat-page" className="flex h-full min-h-0 overflow-hidden rounded-lg">
      <ChatSidebar
        dialogs={dialogs}
        activeDialogId={String(chatStore.activeConversationId ?? "")}
        query={query}
        onQueryChange={setQuery}
        onCreate={() => chatStore.newConversation()}
        onSelect={(dialog) => void chatStore.select(dialog.id)}
        onEdit={(dialog) => {
          setDialogToEdit(dialog);
          setDialogTitle(dialog.title);
        }}
        onDelete={setDialogToDelete}
      />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <ChatTaskPanel />
        <ChatFeed
          title={active?.title ?? "Новый диалог"}
          headerActions={
            <button
              type="button"
              title="Открыть память"
              aria-label={`Открыть память${memoryStore.total ? `, записей: ${memoryStore.total}` : ""}`}
              className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs text-main-400 transition-colors hover:bg-main-700/45 hover:text-main-100"
              onClick={() => setMemoryOpen(true)}
            >
              <BrainIcon className="size-4" />
              <span className="hidden sm:inline">Память</span>
              {memoryStore.total ? (
                <span className="rounded-full bg-accent-medium/10 px-1.5 py-0.5 text-[10px] tabular-nums text-accent-light">
                  {memoryStore.total}
                </span>
              ) : null}
            </button>
          }
          conversationId={chatStore.activeConversationId}
          messages={chatStore.messages
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({
              id: item.id,
              role: item.role as "user" | "assistant",
              text: item.text,
              reasoning: item.reasoning,
              error: item.error,
              toolCalls: item.toolCalls,
              scenarioRunId: item.scenarioRunId,
              status: item.status,
              usageLabel: formatUsageLabel(item.lastUsage),
            }))}
          onSuggestionSelect={setText}
          hasMore={chatStore.hasMoreMessages}
          loadingEarlier={chatStore.loadingEarlier}
          onLoadEarlier={() => chatStore.loadEarlier()}
          actionsDisabled={chatStore.activeRunId !== null}
          onDeleteMessage={async (messageId) => {
            await chatStore.truncateMessages(messageId);
            toasts.success({ title: "Сообщение было успешно удалено" });
          }}
          onEditMessage={async (messageId, nextText) => {
            try {
              await chatStore.truncateMessages(messageId);
              await startMessage(nextText);
              toasts.success({ title: "Сообщение успешно изменено!" });
            } catch (error) {
              toasts.danger({
                title: "Не удалось изменить сообщение",
                description: readableError(error),
              });
              throw error;
            }
          }}
          scenarioExecutions={new Map(chatStore.scenarioExecutions.entries())}
          scenarioNodeOutput={new Map(chatStore.scenarioNodeOutput.entries())}
        />
        <ChatComposer
          topContent={<>{textProviderStore.enabledModels.length === 0 ? <Alert variant="warning" title="Не подключена ни одна модель" rounded=""><div className="flex flex-wrap items-center justify-between gap-2"><span>Подключите провайдера, чтобы получать ответы в чате.</span><Button variant="ghost" onClick={() => navigate(APP_PATHS.settings.providers)}>Настроить провайдера</Button></div></Alert> : null}<ChatQuestionCard /></>}
          text={text}
          mode={mode}
          model={model}
          agentId={agentId}
          scenarioId={scenarioId}
          agentOptions={agentOptions}
          scenarioOptions={scenarioOptions}
          onTextChange={setText}
          onModeChange={setMode}
          onModelChange={setModel}
          onAgentChange={setAgentId}
          onScenarioChange={setScenarioId}
          onSend={send}
          running={chatStore.activeRunId !== null}
          onCancel={() => void chatStore.cancel()}
        />
      </div>
      <DangerModal
        open={chatStore.pendingScenarioApproval !== null}
        model={chatStore.pendingScenarioApproval}
        title="Продолжить сценарий?"
        description={(approval) => approval.prompt}
        confirmLabel="Продолжить"
        onCancel={() => void chatStore.approveScenario(false)}
        onConfirm={() => chatStore.approveScenario(true)}
      />
      <ChatMemoryModal open={memoryOpen} onClose={() => setMemoryOpen(false)} />
      <DangerModal
        open={dialogToDelete !== null}
        model={dialogToDelete}
        title="Удалить диалог?"
        description={(dialog) => (
          <>
            Диалог «
            <strong className="font-semibold text-main-50">
              {dialog.title}
            </strong>
            » и вся его история будут удалены.
          </>
        )}
        onCancel={() => setDialogToDelete(null)}
        onConfirm={async (dialog) => {
          await chatStore.deleteConversation(dialog.id);
          setDialogToDelete(null);
        }}
      />
      {dialogToEdit ? (
        <Modal
          open
          rounded="rounded-4xl"
          className="max-w-md"
          onClose={() => setDialogToEdit(null)}
        >
          <Modal.Header>
            <h2 className="text-lg font-semibold text-main-50">
              Изменить название
            </h2>
          </Modal.Header>
          <Modal.Content>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!dialogTitle.trim()) return;
                setRenaming(true);
                void chatStore
                  .renameConversation(dialogToEdit.id, dialogTitle)
                  .then(() => setDialogToEdit(null))
                  .finally(() => setRenaming(false));
              }}
            >
              <InputSmall
                value={dialogTitle}
                onChange={(event) => setDialogTitle(event.target.value)}
                maxLength={120}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogToEdit(null)}
                >
                  Отмена
                </Button>
                <PrimaryButton
                  type="submit"
                  variant="save"
                  label="Сохранить"
                  loading={renaming}
                  disabled={!dialogTitle.trim()}
                />
              </div>
            </form>
          </Modal.Content>
        </Modal>
      ) : null}
    </section>
  );
});

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+':\s*/i, "");
}

function formatUsageLabel(usage: import("../../../shared/dto").ChatUsage) {
  if (usage.modelId) return textProviderStore.modelLabel(usage.modelId);
  if (usage.scenarioId) {
    const scenario = automationStore.scenarios.find(
      (item) => item.id === usage.scenarioId,
    );
    return `Сценарий: ${scenario?.name ?? usage.scenarioId}`;
  }
  return usage.mode === "agent" ? "Агент" : "Модель не указана";
}

function useStableOptions<T>(options: T[]): T[] {
  const key = JSON.stringify(options);
  const cache = useRef({ key, options });
  if (cache.current.key !== key) cache.current = { key, options };
  return cache.current.options;
}
