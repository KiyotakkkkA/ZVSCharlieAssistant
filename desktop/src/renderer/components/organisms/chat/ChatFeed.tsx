import { ScrollArea, useToasts } from "@kiyotakkkka/zvs-uikit-lib";
import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from "react";
import {
  ChatIcon,
  RobotIcon,
  StorageIcon,
  TasksIcon,
  WordIcon,
} from "../../atoms";
import { ChatAssistantMsgBlock } from "../../molecules/ChatAssistantMsgBlock";
import { ChatUserMsgBlock } from "../../molecules/ChatUserMsgBlock";
import type { ScenarioNodeRun, ScenarioRun } from "../../../../ipc/contracts";
import type { ChatToolCall } from "../../../../ipc/contracts";
import {
  ChatSourcePanel,
  collectChatSources,
  type ChatSources,
} from "./ChatSourcePanel";
import { ScenarioExecutionHistory } from "./ChatScenarioExcecutionHistory";
import {
  ChatArtifactPanel,
  collectChatArtifacts,
  type ChatArtifact,
} from "./ChatArtifactPanel";
import { DangerModal } from "../modals";

const EMPTY_SCENARIO_EXECUTIONS = new Map<
  number,
  { run: ScenarioRun; nodes: ScenarioNodeRun[] }
>();
const EMPTY_SCENARIO_OUTPUT = new Map<string, string>();
const EMPTY_CHAT_SOURCES: ChatSources = { internal: [], web: [] };
const EMPTY_CHAT_ARTIFACTS: ChatArtifact[] = [];

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  reasoning?: string;
  error?: string | null;
  toolCalls?: ChatToolCall[];
  scenarioRunId?: number | null;
  status?: "streaming" | "completed" | "failed" | "cancelled";
}

const suggestions = [
  {
    icon: TasksIcon,
    title: "Составить план",
    prompt: "Помоги составить пошаговый план для нового проекта",
  },
  {
    icon: RobotIcon,
    title: "Запустить агента",
    prompt: "Подбери подходящего агента для моей задачи",
  },
  {
    icon: StorageIcon,
    title: "Разобрать данные",
    prompt: "Помоги структурировать и проанализировать данные",
  },
];

interface ChatFeedProps {
  title: string;
  headerActions?: ReactNode;
  messages: ChatMessage[];
  onSuggestionSelect: (prompt: string) => void;
  conversationId: number | null;
  hasMore: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => Promise<void>;
  actionsDisabled?: boolean;
  onEditMessage: (messageId: number, text: string) => void | Promise<void>;
  onDeleteMessage: (messageId: number) => void | Promise<void>;
  scenarioExecutions?: Map<
    number,
    { run: ScenarioRun; nodes: ScenarioNodeRun[] }
  >;
  scenarioNodeOutput?: Map<string, string>;
}

export function ChatFeed({
  title,
  headerActions,
  messages,
  onSuggestionSelect,
  conversationId,
  hasMore,
  loadingEarlier,
  onLoadEarlier,
  actionsDisabled = false,
  onEditMessage,
  onDeleteMessage,
  scenarioExecutions = EMPTY_SCENARIO_EXECUTIONS,
  scenarioNodeOutput = EMPTY_SCENARIO_OUTPUT,
}: ChatFeedProps) {
  const toasts = useToasts();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openedSources, setOpenedSources] =
    useState<ChatSources>(EMPTY_CHAT_SOURCES);
  const [openedArtifacts, setOpenedArtifacts] =
    useState<ChatArtifact[]>(EMPTY_CHAT_ARTIFACTS);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(
    null,
  );
  const copyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toasts.success({ title: "Сообщение скопировано" });
    } catch {
      toasts.danger({ title: "Не удалось скопировать сообщение" });
    }
  };
  const lastMessageId = messages.at(-1)?.id;
  const lastMessageText = messages.at(-1)?.text;
  const lastMessageReasoning = messages.at(-1)?.reasoning;
  const lastMessageStatus = messages.at(-1)?.status;
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [conversationId]);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [lastMessageId]);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (
      element &&
      element.scrollHeight - element.scrollTop - element.clientHeight < 180
    )
      element.scrollTop = element.scrollHeight;
  }, [lastMessageText, lastMessageReasoning, lastMessageStatus]);
  const handleScroll = async (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    if (element.scrollTop > 80 || !hasMore || loadingEarlier) return;
    const previousHeight = element.scrollHeight;
    await onLoadEarlier();
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight - previousHeight;
    });
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-main-700/35 px-5">
        <div className="flex min-w-0 items-center">
          <span className="mr-3 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-medium/10 text-accent-light">
            <ChatIcon className="size-4" />
          </span>
          <h1 className="truncate text-sm font-semibold text-main-100">
            {title}
          </h1>
        </div>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
          </div>
        ) : null}
      </header>
      <ScrollArea
        ref={scrollRef}
        className="min-h-0 flex-1"
        showScrollbar={false}
        onScroll={(event) => void handleScroll(event)}
      >
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 pb-44 pt-8">
          {messages.length === 0 ? (
            <div className="my-auto flex flex-col items-center py-12 text-center">
              <span className="mb-6 grid size-16 place-items-center rounded-3xl bg-main-700/60 text-accent-light">
                <ChatIcon className="size-7" />
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-main-50">
                Чем могу помочь?
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-main-400">
                Задайте вопрос, составьте план или поручите выполнение одному из
                ваших агентов.
              </p>
              <div className="mt-8 grid w-full gap-3 md:grid-cols-3">
                {suggestions.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className="group rounded-xl bg-main-800/50 p-4 text-left transition-colors hover:bg-main-700/65"
                    onClick={() => onSuggestionSelect(item.prompt)}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-main-700/35 text-main-400 transition-colors group-hover:bg-main-600/70 group-hover:text-main-50">
                      <item.icon className="size-4" />
                    </span>
                    <span className="mt-4 block text-sm font-medium text-main-200">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-main-500">
                      {item.prompt}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-full flex-col gap-9 py-4">
              {loadingEarlier ? (
                <div className="mx-auto flex items-center gap-2 text-xs text-main-500">
                  <span className="size-1.5 animate-pulse rounded-full bg-accent-light" />
                  Загружаю предыдущие сообщения…
                </div>
              ) : null}
              {messages.map((message) =>
                message.role === "user" ? (
                  <ChatUserMsgBlock
                    key={message.id}
                    text={message.text}
                    disabled={actionsDisabled}
                    onCopy={() => void copyMessage(message.text)}
                    onEdit={(text) => onEditMessage(message.id, text)}
                    onDelete={() => setMessageToDelete(message)}
                  />
                ) : (
                  <ChatAssistantMsgBlock
                    key={message.id}
                    text={message.text}
                    reasoning={message.reasoning}
                    status={message.status}
                    error={message.error}
                    toolCalls={message.toolCalls}
                    disabled={actionsDisabled}
                    onCopy={() => void copyMessage(message.text)}
                    onDelete={() => setMessageToDelete(message)}
                    beforeContent={
                      message.scenarioRunId &&
                      scenarioExecutions.get(message.scenarioRunId) ? (
                        <ScenarioExecutionHistory
                          execution={scenarioExecutions.get(
                            message.scenarioRunId,
                          )!}
                          liveOutput={scenarioNodeOutput}
                        />
                      ) : null
                    }
                    actions={
                      <div className="flex flex-wrap gap-2">
                        <MessageSourcesButton
                          toolCalls={message.toolCalls}
                          scenarioNodes={
                            message.scenarioRunId
                              ? scenarioExecutions.get(message.scenarioRunId)
                                  ?.nodes
                              : undefined
                          }
                          onOpen={setOpenedSources}
                        />
                        <MessageArtifactsButton
                          toolCalls={message.toolCalls}
                          scenarioNodes={
                            message.scenarioRunId
                              ? scenarioExecutions.get(message.scenarioRunId)
                                  ?.nodes
                              : undefined
                          }
                          onOpen={setOpenedArtifacts}
                        />
                      </div>
                    }
                  />
                ),
              )}
            </div>
          )}
        </div>
      </ScrollArea>
      <ChatSourcePanel
        sources={openedSources}
        onClose={() => setOpenedSources(EMPTY_CHAT_SOURCES)}
      />
      <ChatArtifactPanel
        artifacts={openedArtifacts}
        onClose={() => setOpenedArtifacts(EMPTY_CHAT_ARTIFACTS)}
      />
      <DangerModal
        open={messageToDelete !== null}
        model={messageToDelete}
        title="Удалить сообщение?"
        description={(message) => (
          <>
            Сообщение «
            <strong className="font-semibold text-main-50">
              {message.text.slice(0, 80)}
              {message.text.length > 80 ? "…" : ""}
            </strong>
            » и вся история после него будут удалены.
          </>
        )}
        onCancel={() => setMessageToDelete(null)}
        onConfirm={async (message) => {
          await onDeleteMessage(message.id);
          setMessageToDelete(null);
        }}
      />
    </div>
  );
}

const MessageSourcesButton = memo(function MessageSourcesButton({
  toolCalls,
  scenarioNodes,
  onOpen,
}: {
  toolCalls?: ChatToolCall[];
  scenarioNodes?: ScenarioNodeRun[];
  onOpen: (sources: ChatSources) => void;
}) {
  const sources = collectChatSources(toolCalls, scenarioNodes);
  const count = sources.internal.length + sources.web.length;
  if (!count) return null;
  return (
    <button
      type="button"
      className="mt-5 cursor-pointer inline-flex items-center gap-2 rounded-lg bg-main-800/55 px-3 py-2 text-xs font-medium text-main-300 transition-colors hover:bg-main-700/70 hover:text-main-50"
      onClick={() => onOpen(sources)}
    >
      <StorageIcon className="size-4 text-accent-light" />
      Источники
      <span className="rounded-md bg-main-700/60 px-1.5 py-0.5 text-[10px] text-main-400">
        {count}
      </span>
    </button>
  );
});

const MessageArtifactsButton = memo(function MessageArtifactsButton({
  toolCalls,
  scenarioNodes,
  onOpen,
}: {
  toolCalls?: ChatToolCall[];
  scenarioNodes?: ScenarioNodeRun[];
  onOpen: (artifacts: ChatArtifact[]) => void;
}) {
  const artifacts = collectChatArtifacts(toolCalls, scenarioNodes);
  if (!artifacts.length) return null;
  return (
    <button
      type="button"
      className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-main-800/55 px-3 py-2 text-xs font-medium text-main-300 transition-colors hover:bg-main-700/70 hover:text-main-50"
      onClick={() => onOpen(artifacts)}
    >
      <WordIcon className="size-4 text-accent-light" />
      Созданные артефакты
      <span className="rounded-md bg-main-700/60 px-1.5 py-0.5 text-[10px] text-main-400">
        {artifacts.length}
      </span>
    </button>
  );
});
