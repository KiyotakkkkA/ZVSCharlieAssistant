import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Button,
  InputSmall,
  Modal,
  useToasts,
} from "@kiyotakkkka/zvs-uikit-lib";
import {
  ChatComposer,
  ChatFeed,
  ChatSidebar,
  DangerModal,
  type ChatDialog,
  type ChatMode,
  type ChatModel,
} from "../../components/organisms";
import { automationStore, chatStore, textProviderStore } from "../../stores";
import { PrimaryButton } from "@renderer/components/atoms/buttons";

export const ChatPage = observer(function ChatPage() {
  const toasts = useToasts();
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
  const nextModelOptions = textProviderStore.enabledModels.map((item) => ({
    value: String(item.id),
    label: item.name,
    description: textProviderStore.providers.find(
      (p) => p.id === item.providerId,
    )?.name,
  }));
  const nextAgentOptions = automationStore.agents.map((agent) => ({
    value: agent.id,
    label: agent.name,
  }));
  const nextScenarioOptions = automationStore.scenarios
    .filter((scenario) => scenario.status === "active")
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
  const send = () => {
    const value = text.trim();
    if (!value || (mode !== "scenario" && !model) || chatStore.activeRunId)
      return;
    setText("");
    void chatStore
      .start({
        mode,
        modelId: mode === "scenario" ? undefined : Number(model),
        agentId: mode === "agent" ? agentId : undefined,
        scenarioId: mode === "scenario" ? scenarioId : undefined,
        text: value,
      })
      .catch((error: unknown) => {
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
    <section className="flex h-full min-h-0 overflow-hidden rounded-lg">
      <ChatSidebar
        dialogs={dialogs}
        activeDialogId={String(chatStore.activeConversationId ?? "")}
        query={query}
        onQueryChange={setQuery}
        onCreate={() => chatStore.newConversation()}
        onSelect={(dialog) => void chatStore.select(Number(dialog.id))}
        onEdit={(dialog) => {
          setDialogToEdit(dialog);
          setDialogTitle(dialog.title);
        }}
        onDelete={setDialogToDelete}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatFeed
          title={active?.title ?? "Новый диалог"}
          conversationId={chatStore.activeConversationId}
          messages={chatStore.messages
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({
              id: item.id,
              role: item.role as "user" | "assistant",
              text: item.text,
              reasoning: item.reasoning,
              toolCalls: item.toolCalls,
              scenarioRunId: item.scenarioRunId,
              status: item.status,
            }))}
          onSuggestionSelect={setText}
          hasMore={chatStore.hasMoreMessages}
          loadingEarlier={chatStore.loadingEarlier}
          onLoadEarlier={() => chatStore.loadEarlier()}
          scenarioExecutions={new Map(chatStore.scenarioExecutions.entries())}
          scenarioNodeOutput={new Map(chatStore.scenarioNodeOutput.entries())}
        />
        <ChatComposer
          text={text}
          mode={mode}
          model={model}
          agentId={agentId}
          scenarioId={scenarioId}
          agentOptions={agentOptions}
          scenarioOptions={scenarioOptions}
          modelOptions={modelOptions}
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
      {chatStore.pendingScenarioApproval ? (
        <DangerModal
          model={chatStore.pendingScenarioApproval}
          title="Продолжить сценарий?"
          description={(approval) => approval.prompt}
          confirmLabel="Продолжить"
          onCancel={() => void chatStore.approveScenario(false)}
          onConfirm={() => chatStore.approveScenario(true)}
        />
      ) : null}
      {dialogToDelete ? (
        <DangerModal
          model={dialogToDelete}
          title="Удалить диалог?"
          description={(dialog) =>
            `Диалог «${dialog.title}» и вся его история будут удалены.`
          }
          onCancel={() => setDialogToDelete(null)}
          onConfirm={async (dialog) => {
            await chatStore.deleteConversation(Number(dialog.id));
            setDialogToDelete(null);
          }}
        />
      ) : null}
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
                  .renameConversation(Number(dialogToEdit.id), dialogTitle)
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

function useStableOptions<T>(options: T[]): T[] {
  const key = JSON.stringify(options);
  const cache = useRef({ key, options });
  if (cache.current.key !== key) cache.current = { key, options };
  return cache.current.options;
}
