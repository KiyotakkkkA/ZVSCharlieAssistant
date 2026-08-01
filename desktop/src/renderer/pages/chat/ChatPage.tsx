import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  ChatComposer,
  ChatFeed,
  ChatSidebar,
  type ChatDialog,
  type ChatMessage,
  type ChatMode,
  type ChatModel,
} from "../../components/organisms";
import { automationStore } from "../../stores";

const initialDialogs: ChatDialog[] = [
  {
    id: "new",
    title: "Новый диалог",
    preview: "Начните новый разговор",
    date: "Сейчас",
  },
  {
    id: "project-plan",
    title: "План запуска проекта",
    preview: "Разбили работу на пять этапов",
    date: "Вчера",
  },
  {
    id: "data-review",
    title: "Анализ отчёта",
    preview: "Ключевые выводы и рекомендации",
    date: "28 июл.",
  },
  {
    id: "agent-task",
    title: "Задача для агента",
    preview: "Подготовить структуру документа",
    date: "25 июл.",
  },
];

export const ChatPage = observer(function ChatPage() {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatMode>("chat");
  const [model, setModel] = useState<ChatModel>("gpt-5");
  const [agentId, setAgentId] = useState(automationStore.agents[0]?.id ?? "");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dialogs, setDialogs] = useState(initialDialogs);
  const [activeDialogId, setActiveDialogId] = useState("new");
  const [dialogQuery, setDialogQuery] = useState("");

  const activeDialog =
    dialogs.find((dialog) => dialog.id === activeDialogId) ?? dialogs[0];
  const visibleDialogs = useMemo(() => {
    const normalized = dialogQuery.trim().toLocaleLowerCase();
    return normalized
      ? dialogs.filter((dialog) =>
          `${dialog.title} ${dialog.preview}`
            .toLocaleLowerCase()
            .includes(normalized),
        )
      : dialogs;
  }, [dialogQuery, dialogs]);
  const agentOptions = useMemo(
    () =>
      automationStore.agents.map((agent) => ({
        value: agent.id,
        label: agent.name,
      })),
    [automationStore.agents],
  );

  useEffect(() => {
    if (!agentId && automationStore.agents[0])
      setAgentId(automationStore.agents[0].id);
  }, [agentId, automationStore.agents]);

  const createDialog = () => {
    const id = `dialog-${Date.now()}`;
    const dialog: ChatDialog = {
      id,
      title: "Новый диалог",
      preview: "Начните новый разговор",
      date: "Сейчас",
    };
    setDialogs((current) => [dialog, ...current]);
    setActiveDialogId(id);
    setMessages([]);
    setText("");
  };

  const sendMessage = () => {
    const value = text.trim();
    if (!value) return;
    const now = Date.now();
    setMessages((current) => [
      ...current,
      { id: now, role: "user", text: value },
      {
        id: now + 1,
        role: "assistant",
        text:
          mode === "planner"
            ? "Я подготовлю понятный план и разобью задачу на последовательные шаги. Это демонстрационный ответ интерфейса."
            : mode === "agent"
              ? "Агент получил задачу. Здесь будут отображаться ход выполнения, вызовы инструментов и итоговый результат."
              : "Понял задачу. Это демонстрационный ответ — здесь появится содержимое диалога с выбранной моделью.",
      },
    ]);
    setDialogs((current) =>
      current.map((dialog) =>
        dialog.id === activeDialogId
          ? {
              ...dialog,
              title:
                dialog.title === "Новый диалог"
                  ? value.slice(0, 36)
                  : dialog.title,
              preview: value,
              date: "Сейчас",
            }
          : dialog,
      ),
    );
    setText("");
  };

  return (
    <section className="flex h-full min-h-0 overflow-hidden rounded-lg">
      <ChatSidebar
        dialogs={visibleDialogs}
        activeDialogId={activeDialogId}
        query={dialogQuery}
        onQueryChange={setDialogQuery}
        onCreate={createDialog}
        onSelect={(dialog) => {
          setActiveDialogId(dialog.id);
          setMessages([]);
          setText("");
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatFeed
          title={activeDialog?.title ?? "Новый диалог"}
          messages={messages}
          onSuggestionSelect={setText}
        />
        <ChatComposer
          text={text}
          mode={mode}
          model={model}
          agentId={agentId}
          agentOptions={agentOptions}
          onTextChange={setText}
          onModeChange={setMode}
          onModelChange={setModel}
          onAgentChange={setAgentId}
          onSend={sendMessage}
        />
      </div>
    </section>
  );
});
