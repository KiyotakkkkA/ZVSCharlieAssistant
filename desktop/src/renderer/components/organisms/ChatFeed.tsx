import {
  Accordion,
  CodeView,
  ScrollArea,
  Skeleton,
  Timeline,
} from "@kiyotakkkka/zvs-uikit-lib";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  isValidElement,
  memo,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type UIEvent,
} from "react";
import { ChatIcon, RobotIcon, StorageIcon, TasksIcon } from "../atoms";
import type { ScenarioNodeRun, ScenarioRun } from "../../../ipc/contracts";
import type { ChatToolCall } from "../../../ipc/contracts";

const MemoizedReactMarkdown = memo(
  ReactMarkdown,
  (previous, next) => previous.children === next.children,
);
const EMPTY_SCENARIO_EXECUTIONS = new Map<
  number,
  { run: ScenarioRun; nodes: ScenarioNodeRun[] }
>();
const EMPTY_SCENARIO_OUTPUT = new Map<string, string>();

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  reasoning?: string;
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
  messages: ChatMessage[];
  onSuggestionSelect: (prompt: string) => void;
  conversationId: number | null;
  hasMore: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => Promise<void>;
  scenarioExecutions?: Map<
    number,
    { run: ScenarioRun; nodes: ScenarioNodeRun[] }
  >;
  scenarioNodeOutput?: Map<string, string>;
}

export function ChatFeed({
  title,
  messages,
  onSuggestionSelect,
  conversationId,
  hasMore,
  loadingEarlier,
  onLoadEarlier,
  scenarioExecutions = EMPTY_SCENARIO_EXECUTIONS,
  scenarioNodeOutput = EMPTY_SCENARIO_OUTPUT,
}: ChatFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
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
      <header className="flex h-14 shrink-0 items-center border-b border-main-700/35 px-5">
        <span className="mr-3 grid size-8 place-items-center rounded-lg bg-accent-medium/10 text-accent-light">
          <ChatIcon className="size-4" />
        </span>
        <div>
          <h1 className="text-sm font-semibold text-main-100">{title}</h1>
          <p className="text-[11px] text-main-500">
            Сообщения сохраняются локально
          </p>
        </div>
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
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? "flex justify-end"
                      : "group/message flex justify-start gap-3.5"
                  }
                >
                  {message.role === "assistant" ? (
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light ring-1 ring-accent-medium/10">
                      <ChatIcon className="size-4" />
                    </span>
                  ) : null}
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[min(75%,42rem)] rounded-2xl rounded-br-md bg-main-700/65 px-4 py-3 text-[14px] leading-6 text-main-100"
                        : "min-w-0 w-full max-w-3xl py-1 text-[14px] leading-7 text-main-200"
                    }
                  >
                    {message.role === "assistant" ? (
                      <div className="min-w-0">
                        {message.scenarioRunId &&
                        scenarioExecutions.get(message.scenarioRunId) ? (
                          <ScenarioExecutionHistory
                            execution={
                              scenarioExecutions.get(message.scenarioRunId)!
                            }
                            liveOutput={scenarioNodeOutput}
                          />
                        ) : null}
                        {message.reasoning ? (
                          <Accordion className="mb-4 overflow-hidden rounded-xl bg-main-800/45 ring-1 ring-main-700/35">
                            <Accordion.Summary className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-main-400 transition-colors hover:bg-main-700/30 hover:text-main-200">
                              Ход рассуждений
                            </Accordion.Summary>
                            <Accordion.Content className="border-t border-main-700/30 px-3.5 py-3 text-xs leading-5 text-main-500 whitespace-pre-wrap">
                              {message.reasoning}
                            </Accordion.Content>
                          </Accordion>
                        ) : null}
                        {message.toolCalls?.length ? (
                          <div className="mb-4 space-y-2">
                            {message.toolCalls.map((call) => (
                              <ToolCallDetails key={call.id} call={call} />
                            ))}
                          </div>
                        ) : null}
                        {!message.text && message.status === "streaming" ? (
                          <div
                            className="w-full max-w-xl space-y-2.5 py-1"
                            aria-label="Ассистент размышляет"
                          >
                            <span className="mb-3 flex items-center gap-2 text-xs font-medium text-main-500">
                              <span className="size-1.5 animate-pulse rounded-full bg-accent-light" />
                              Размышляет…
                            </span>
                            <Skeleton
                              animated
                              tone="subtle"
                              className="h-3 w-full"
                              rounded="full"
                            />
                            <Skeleton
                              animated
                              tone="subtle"
                              className="h-3 w-5/6"
                              rounded="full"
                            />
                            <Skeleton
                              animated
                              tone="subtle"
                              className="h-3 w-2/3"
                              rounded="full"
                            />
                          </div>
                        ) : (
                          <MemoizedReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-4 last:mb-0">{children}</p>
                              ),
                              h1: ({ children }) => (
                                <h1 className="mb-4 mt-7 text-xl font-semibold text-main-50 first:mt-0">
                                  {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="mb-3 mt-6 text-lg font-semibold text-main-50 first:mt-0">
                                  {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="mb-2 mt-5 text-base font-semibold text-main-100 first:mt-0">
                                  {children}
                                </h3>
                              ),
                              ul: ({ children }) => (
                                <ul className="mb-4 list-disc space-y-1.5 pl-6 marker:text-main-500">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="mb-4 list-decimal space-y-1.5 pl-6 marker:font-medium marker:text-main-500">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="pl-1">{children}</li>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-main-50">
                                  {children}
                                </strong>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="my-4 border-l-2 border-accent-medium/60 bg-main-800/30 py-2 pl-4 pr-3 text-main-400">
                                  {children}
                                </blockquote>
                              ),
                              code: ({ children, className }) => (
                                <code
                                  className={
                                    className
                                      ? `${className} text-main-200`
                                      : "rounded-md bg-main-800 px-1.5 py-0.5 text-[12px] text-accent-light ring-1 ring-main-700/40"
                                  }
                                >
                                  {children}
                                </code>
                              ),
                              pre: MarkdownCodeBlock,
                              table: ({ children }) => (
                                <div className="my-5 overflow-x-auto rounded-xl ring-1 ring-main-700/45">
                                  <table className="w-full min-w-lg border-collapse text-left text-[13px]">
                                    {children}
                                  </table>
                                </div>
                              ),
                              thead: ({ children }) => (
                                <thead className="bg-main-800/80 text-main-200">
                                  {children}
                                </thead>
                              ),
                              tbody: ({ children }) => (
                                <tbody className="divide-y divide-main-700/35">
                                  {children}
                                </tbody>
                              ),
                              tr: ({ children }) => (
                                <tr className="transition-colors hover:bg-main-800/30">
                                  {children}
                                </tr>
                              ),
                              th: ({ children }) => (
                                <th className="border-r border-main-700/35 px-4 py-3 text-xs font-semibold last:border-r-0">
                                  {children}
                                </th>
                              ),
                              td: ({ children }) => (
                                <td className="border-r border-main-700/25 px-4 py-3 align-top last:border-r-0">
                                  {children}
                                </td>
                              ),
                              hr: () => (
                                <hr className="my-6 border-main-700/40" />
                              ),
                              a: ({ children, href }) => (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-accent-light underline decoration-accent-medium/40 underline-offset-2 transition-colors hover:text-main-50"
                                >
                                  {children}
                                </a>
                              ),
                            }}
                          >
                            {message.text}
                          </MemoizedReactMarkdown>
                        )}
                      </div>
                    ) : (
                      message.text
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ToolCallDetails({ call }: { call: ChatToolCall }) {
  const label =
    call.toolId === "web.search" ? "Поиск в интернете" : "Чтение страницы";
  const statusLabel = {
    requested: "Подготовка",
    running: "Выполняется",
    completed: "Завершено",
    failed: "Ошибка",
  }[call.status];
  return (
    <Accordion className="overflow-hidden rounded-xl bg-main-800/45 ring-1 ring-main-700/35">
      <Accordion.Summary className="px-3.5 py-2.5 text-left transition-colors hover:bg-main-700/30">
        <div className="flex w-full gap-3 items-center justify-between">
          <span className="min-w-0 truncate text-xs font-medium text-main-300">
            {label}
          </span>
          <span
            className={`shrink-0 text-[11px] ${call.status === "failed" ? "text-danger-light" : call.status === "completed" ? "text-accent-light" : "text-main-500"}`}
          >
            {statusLabel}
          </span>
        </div>
      </Accordion.Summary>
      <Accordion.Content className="space-y-3 border-t border-main-700/30 px-3.5 py-3 text-xs leading-5 text-main-400">
        <ToolCallValue title="Запрос" value={call.input} />
        {call.output !== null ? (
          <ToolCallValue title="Результат" value={call.output} />
        ) : null}
        {call.error ? (
          <div className="text-danger-light">{call.error}</div>
        ) : null}
      </Accordion.Content>
    </Accordion>
  );
}

function ToolCallValue({ title, value }: { title: string; value: unknown }) {
  const code =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-main-500">{title}</div>
      <CodeView
        code={code}
        language={typeof value === "string" ? "text" : "json"}
        fileName={title === "Запрос" ? "request.json" : "response.json"}
        copyable
        defaultActions
        maxContentHeight={288}
      />
    </div>
  );
}

function MarkdownCodeBlock({ children }: { children?: ReactNode }) {
  const child = isValidElement<{ children?: ReactNode; className?: string }>(
    children,
  )
    ? children
    : null;
  const code = String(child?.props.children ?? children ?? "").replace(
    /\n$/,
    "",
  );
  const language = child?.props.className?.replace(/^language-/, "") || "text";
  return (
    <CodeView
      className="my-4"
      code={code}
      language={language}
      copyable
      defaultActions
      maxContentHeight={420}
    />
  );
}

function ScenarioExecutionHistory({
  execution,
  liveOutput,
}: {
  execution: { run: ScenarioRun; nodes: ScenarioNodeRun[] };
  liveOutput: Map<string, string>;
}) {
  const running = ["queued", "running", "waiting_for_approval"].includes(
    execution.run.status,
  );
  return (
    <section className="mb-5 overflow-hidden rounded-xl bg-main-800/40 ring-1 ring-main-700/40">
      <header className="flex items-center justify-between gap-4 border-b border-main-700/30 px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium text-main-200">
            {execution.run.scenarioName}
          </span>
          <span className="mt-0.5 block text-[11px] text-main-500">
            Выполнение #{execution.run.id} · {execution.nodes.length} шагов
          </span>
        </span>
        <span
          className={`flex shrink-0 items-center gap-2 text-[11px] ${
            running
              ? "text-accent-light"
              : execution.run.status === "completed"
                ? "text-success-light"
                : "text-danger-light"
          }`}
        >
          {running ? (
            <span className="size-1.5 animate-pulse rounded-full bg-accent-light" />
          ) : null}
          {scenarioStatusLabel(execution.run.status)}
        </span>
      </header>
      <div className="px-4 py-4">
        <Timeline>
          {execution.nodes.map((node) => {
            const exposesContent =
              node.nodeKind !== "trigger" && node.nodeKind !== "output";
            const text = exposesContent
              ? ((running ? liveOutput.get(node.nodeId) : undefined) ??
                formatNodeValue(node.output))
              : "";
            return (
              <Timeline.Item key={node.id} icon={nodeKindIcon(node.nodeKind)}>
                <Timeline.ItemTitle>
                  {nodeKindLabel(node.nodeKind)} · {node.nodeId}
                </Timeline.ItemTitle>
                <Timeline.ItemSubTitle>
                  {scenarioStatusLabel(node.status)}
                </Timeline.ItemSubTitle>
                {node.error || text ? (
                  <Timeline.ItemContent>
                    <div
                      className={`max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 ${
                        node.error ? "text-danger-light" : "text-main-400"
                      }`}
                    >
                      {node.error ?? text}
                    </div>
                  </Timeline.ItemContent>
                ) : null}
              </Timeline.Item>
            );
          })}
        </Timeline>
      </div>
    </section>
  );
}

function formatNodeValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function nodeKindLabel(kind: ScenarioNodeRun["nodeKind"]) {
  return {
    trigger: "Триггер",
    orchestrator: "Оркестратор",
    agent: "Агент",
    knowledge_store: "Хранилище",
    condition: "Условие",
    approval: "Подтверждение",
    output: "Результат",
  }[kind];
}

function nodeKindIcon(kind: ScenarioNodeRun["nodeKind"]) {
  return {
    trigger: "mdi:message-outline",
    orchestrator: "mdi:robot-outline",
    agent: "mdi:account-cog-outline",
    knowledge_store: "mdi:database-search-outline",
    condition: "mdi:source-branch",
    approval: "mdi:check-decagram-outline",
    output: "mdi:send-outline",
  }[kind];
}

function scenarioStatusLabel(status: ScenarioRun["status"]) {
  return {
    queued: "В очереди",
    running: "Выполняется",
    waiting_for_approval: "Ожидает подтверждения",
    completed: "Завершено",
    failed: "Ошибка",
    cancelled: "Отменено",
  }[status];
}
