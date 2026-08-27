import { Accordion, Alert, Skeleton } from "@kiyotakkkka/zvs-uikit-lib";
import { CodeView } from "@kiyotakkkka/zvs-uikit-lib/code-view";
import { isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatToolCall } from "../../../ipc/contracts";
import type { ChatMessageContentPart } from "../../../shared/dto";
import {
  BrainIcon,
  ChatIcon,
  PlanIcon,
  QuestionIcon,
  StorageIcon,
  WebIcon,
  WordIcon,
} from "../atoms";
import { ControlButton } from "../atoms/buttons";
import { CompactToolStatus } from "./CompactToolStatus";
import { FileSystemToolStatus, isFileSystemTool } from "./FileSystemToolStatus";

export interface ChatAssistantMsgBlockProps {
  text: string;
  usageLabel?: string;
  reasoning?: string;
  status?: "streaming" | "completed" | "failed" | "cancelled";
  error?: string | null;
  toolCalls?: ChatToolCall[];
  parts?: ChatMessageContentPart[];
  beforeContent?: ReactNode;
  actions?: ReactNode;
  disabled?: boolean;
  onCopy?: () => void;
  onDelete?: () => void;
}

export const ChatAssistantMsgBlock = memo(function ChatAssistantMsgBlock({
  text,
  usageLabel,
  reasoning,
  status,
  error,
  toolCalls,
  parts,
  beforeContent,
  actions,
  disabled = false,
  onCopy,
  onDelete,
}: ChatAssistantMsgBlockProps) {
  return (
    <div className="group/message flex justify-start gap-3.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-accent-medium/10 text-accent-light ring-1 ring-accent-medium/10">
        <ChatIcon className="size-4" />
      </span>
      <div className="min-w-0 w-full max-w-3xl py-1 text-[14px] leading-7 text-main-200">
        {beforeContent}
        <AssistantContentTimeline
          parts={parts}
          text={text}
          reasoning={reasoning}
          toolCalls={toolCalls}
          streaming={status === "streaming"}
        />
        {status === "failed" && error ? (
          <Alert
            variant="danger"
            title="Не удалось получить ответ"
            className="my-4"
          >
            {error}
          </Alert>
        ) : null}
        {actions}
        <div className="mt-1 flex justify-between items-center opacity-0 transition-opacity group-hover/message:opacity-100">
          <div className="flex gap-1">
            <ControlButton icon="copy" title="Копировать" onClick={onCopy} />
            <ControlButton
              variant="delete"
              icon="trash"
              title="Удалить"
              disabled={disabled}
              onClick={onDelete}
            />
          </div>
          {usageLabel ? (
            <span
              className="mr-1 truncate text-[11px] text-main-500"
              title={usageLabel}
            >
              {usageLabel}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});

function AssistantContentTimeline({
  parts,
  text,
  reasoning,
  toolCalls = [],
  streaming,
}: {
  parts?: ChatMessageContentPart[];
  text: string;
  reasoning?: string;
  toolCalls?: ChatToolCall[];
  streaming: boolean;
}) {
  if (!parts?.length) {
    return (
      <>
        {reasoning ? <ReasoningBlock text={reasoning} /> : null}
        {toolCalls.length ? (
          <div className="mb-4 space-y-2">
            {toolCalls.map((call) => (
              <ToolCallDetails key={call.id} call={call} />
            ))}
          </div>
        ) : null}
        {!text && streaming ? (
          <AssistantSkeleton />
        ) : (
          <AnswerBlock text={text} />
        )}
      </>
    );
  }

  const resultByCallId = new Map(
    parts
      .filter((part) => part.type === "tool-result")
      .map((part) => [part.toolCallId, part]),
  );
  const visibleParts = parts.filter((part) => part.type !== "tool-result");

  return (
    <div className="space-y-4">
      {visibleParts.map((part, index) => {
        if (part.type === "reasoning")
          return <ReasoningBlock key={`reasoning-${index}`} text={part.text} />;
        if (part.type === "text")
          return <AnswerBlock key={`text-${index}`} text={part.text} />;
        if (part.type === "summary")
          return (
            <AnswerBlock key={`summary-${part.segmentId}`} text={part.text} />
          );
        if (part.type === "tool-call") {
          const liveCall = toolCalls.find(
            (call) => call.id === part.toolCallId,
          );
          const result = resultByCallId.get(part.toolCallId);
          const call: ChatToolCall = liveCall ?? {
            id: part.toolCallId,
            toolId: part.toolName,
            status: result?.isError
              ? "failed"
              : result
                ? "completed"
                : "requested",
            input: part.input,
            output: result?.output ?? null,
            error:
              result?.isError &&
              typeof result.output === "object" &&
              result.output !== null &&
              "error" in result.output
                ? String(result.output.error)
                : null,
          };
          return (
            <ToolCallDetails key={`tool-${part.toolCallId}`} call={call} />
          );
        }
        return null;
      })}
      {streaming && visibleParts.length === 0 ? <AssistantSkeleton /> : null}
    </div>
  );
}

function ReasoningBlock({ text }: { text: string }) {
  return (
    <Accordion className="overflow-hidden rounded-xl bg-main-800/45 ring-1 ring-main-700/35">
      <Accordion.Summary className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-main-400 transition-colors hover:bg-main-700/30 hover:text-main-200">
        Ход рассуждений
      </Accordion.Summary>
      <Accordion.Content className="border-t border-main-700/30 px-3.5 py-3 text-xs leading-5 text-main-500 whitespace-pre-wrap">
        {text}
      </Accordion.Content>
    </Accordion>
  );
}

function AnswerBlock({ text }: { text: string }) {
  if (!text) return null;
  return (
    <MarkdownContent
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {text}
    </MarkdownContent>
  );
}

const MarkdownContent = memo(
  ReactMarkdown,
  (previous, next) => previous.children === next.children,
);

function AssistantSkeleton() {
  return (
    <div
      className="w-full max-w-xl space-y-2.5 py-1"
      aria-label="Ассистент размышляет"
    >
      <span className="mb-3 flex items-center gap-2 text-xs font-medium text-main-500">
        <span className="size-1.5 animate-pulse rounded-full bg-accent-light" />
        Размышляет…
      </span>
      <Skeleton animated tone="subtle" className="h-3 w-full" rounded="full" />
      <Skeleton animated tone="subtle" className="h-3 w-5/6" rounded="full" />
      <Skeleton animated tone="subtle" className="h-3 w-2/3" rounded="full" />
    </div>
  );
}

function ToolCallDetails({ call }: { call: ChatToolCall }) {
  if (isFileSystemTool(call.toolId)) {
    return <FileSystemToolStatus call={call} />;
  }
  if (call.toolId === "memory_save" || call.toolId === "memory_search") {
    const saving = call.toolId === "memory_save";
    return (
      <CompactToolStatus>
        <CompactToolStatus.Trigger
          icon={BrainIcon}
          running={saving ? "Идёт сохранение в память" : "Идёт поиск в памяти"}
          completed={
            saving ? "Информация сохранена в память" : "Поиск в памяти завершён"
          }
          status={call.status}
        />
        <CompactToolStatus.Expandable className="p-0!">
          <MemoryToolDetails call={call} />
        </CompactToolStatus.Expandable>
      </CompactToolStatus>
    );
  }
  if (call.toolId === "web_search" || call.toolId === "web_fetch")
    return (
      <CompactToolStatus>
        <CompactToolStatus.Trigger
          icon={WebIcon}
          running="Идёт поиск в интернете"
          completed="Выполнен поиск в интернете"
          status={call.status}
        />
      </CompactToolStatus>
    );
  if (call.toolId === "vecdb_search")
    return (
      <CompactToolStatus>
        <CompactToolStatus.Trigger
          icon={StorageIcon}
          running="Идёт поиск в хранилище"
          completed="Поиск в хранилище завершён"
          status={call.status}
        />
      </CompactToolStatus>
    );
  if (
    call.toolId === "reports_docx" ||
    call.toolId === "reports_begin" ||
    call.toolId === "reports_add_blocks" ||
    call.toolId === "reports_commit" ||
    call.toolId === "reports_abort"
  )
    return (
      <CompactToolStatus>
        <CompactToolStatus.Trigger
          icon={WordIcon}
          running={reportToolLabel(call.toolId, false)}
          completed={reportToolLabel(call.toolId, true)}
          status={call.status}
        />
      </CompactToolStatus>
    );
  if (call.toolId === "tasks_plan") {
    return (
      <CompactToolStatus>
        <CompactToolStatus.Trigger
          icon={PlanIcon}
          running="Идёт создание плана"
          completed="План обновлён"
          status={call.status}
        />
      </CompactToolStatus>
    );
  }
  if (call.toolId === "ask_user")
    return (
      <CompactToolStatus>
        <CompactToolStatus.Trigger
          icon={QuestionIcon}
          running="Идёт запрос информации у пользователя"
          completed="Информация от пользователя получена"
          status={call.status}
        />
        <CompactToolStatus.Expandable>
          <AskUserDetails call={call} />
        </CompactToolStatus.Expandable>
      </CompactToolStatus>
    );
  const statusLabel = {
    requested: "Подготовка",
    running: "Выполняется",
    completed: "Завершено",
    failed: "Ошибка",
  }[call.status];
  return (
    <Accordion className="overflow-hidden rounded-xl bg-main-800/45 ring-1 ring-main-700/35">
      <Accordion.Summary className="px-3.5 py-2.5 text-left transition-colors hover:bg-main-700/30">
        <div className="flex w-full items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs font-medium text-main-300">
            {call.toolId}
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

function reportToolLabel(toolId: string, completed: boolean) {
  const labels: Record<string, [string, string]> = {
    reports_docx: ["Идёт создание отчёта", "Отчёт DOCX создан"],
    reports_begin: ["Подготавливается отчёт", "Сборка отчёта начата"],
    reports_add_blocks: ["Добавляется часть отчёта", "Часть отчёта добавлена"],
    reports_commit: ["Собирается DOCX", "Отчёт DOCX создан"],
    reports_abort: ["Отменяется сборка отчёта", "Сборка отчёта отменена"],
  };
  return labels[toolId]?.[completed ? 1 : 0] ?? toolId;
}

function AskUserDetails({ call }: { call: ChatToolCall }) {
  const input = isRecord(call.input) ? call.input : null;
  const output = isRecord(call.output) ? call.output : null;
  const question = typeof input?.question === "string" ? input.question : null;
  const rawAnswer = output?.answer;
  const answer = Array.isArray(rawAnswer)
    ? rawAnswer
        .filter((item): item is string => typeof item === "string")
        .join(", ")
    : typeof rawAnswer === "string"
      ? rawAnswer
      : null;

  return (
    <div className="space-y-1">
      {question ? <p>{question}</p> : null}
      {answer ? (
        <p className="font-medium text-main-100">{answer}</p>
      ) : call.error ? (
        <p className="text-danger-light">{call.error}</p>
      ) : (
        <p className="text-main-500">Ожидается ответ пользователя</p>
      )}
    </div>
  );
}

const MEMORY_KIND_LABELS: Record<string, string> = {
  fact: "Факт",
  preference: "Предпочтение",
  instruction: "Указание",
  episode: "Событие",
};

function MemoryToolDetails({ call }: { call: ChatToolCall }) {
  const input = isRecord(call.input) ? call.input : {};

  if (call.toolId === "memory_save") {
    const kind = typeof input.kind === "string" ? input.kind : "fact";
    const title =
      typeof input.title === "string" ? input.title : "Новая запись";
    const content = typeof input.content === "string" ? input.content : "";
    const tags = Array.isArray(input.tags)
      ? input.tags.filter((tag): tag is string => typeof tag === "string")
      : [];

    return (
      <div className="overflow-hidden rounded-xl">
        <div className="relative px-4 py-4">
          <div
            aria-hidden="true"
            className="absolute bottom-3 left-0 top-3 w-px"
          />
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-accent-medium/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-light ring-1 ring-accent-medium/15">
              {MEMORY_KIND_LABELS[kind] ?? kind}
            </span>
            <span className="text-[11px] text-main-600">
              Добавлено в память
            </span>
          </div>
          <p className="text-sm font-medium text-main-100">
            {humanizeMemoryTitle(title)}
          </p>
          {content ? (
            <p className="mt-1.5 text-[13px] leading-5 text-main-300">
              {content}
            </p>
          ) : null}
          {tags.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-main-800 px-2 py-0.5 text-[10px] text-main-500 ring-1 ring-main-700/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {call.error ? (
          <div className="border-t border-danger-medium/20 bg-danger-medium/5 px-4 py-2.5 text-xs text-danger-light">
            {call.error}
          </div>
        ) : null}
      </div>
    );
  }

  const query = typeof input.query === "string" ? input.query : "";
  const output = isRecord(call.output) ? call.output : {};
  const entries = Array.isArray(output.entries)
    ? output.entries.filter(isRecord)
    : [];

  return (
    <div className="overflow-hidden rounded-xl">
      <div className="flex items-center gap-2 border-b border-main-700/45 px-4 py-3">
        <span className="text-[11px] text-main-500">Запрос</span>
        <span className="min-w-0 truncate text-xs text-main-200">
          {query || "Поиск по памяти"}
        </span>
        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-main-600">
          {entries.length} найдено
        </span>
      </div>
      {entries.length ? (
        <ul className="divide-y divide-main-700/35">
          {entries.map((entry, index) => {
            const kind = typeof entry.kind === "string" ? entry.kind : "fact";
            return (
              <li key={String(entry.id ?? index)} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-accent-light">
                    {MEMORY_KIND_LABELS[kind] ?? kind}
                  </span>
                  <span className="truncate text-xs font-medium text-main-200">
                    {humanizeMemoryTitle(String(entry.title ?? "Запись"))}
                  </span>
                </div>
                {typeof entry.content === "string" ? (
                  <p className="mt-1 text-xs leading-5 text-main-400">
                    {entry.content}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-4 text-xs text-main-500">
          Подходящих записей не найдено
        </p>
      )}
      {call.error ? (
        <div className="border-t border-danger-medium/20 bg-danger-medium/5 px-4 py-2.5 text-xs text-danger-light">
          {call.error}
        </div>
      ) : null}
    </div>
  );
}

function humanizeMemoryTitle(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

const markdownComponents = {
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-4 last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mb-4 mt-7 text-xl font-semibold text-main-50 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-3 mt-6 text-lg font-semibold text-main-50 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-2 mt-5 text-base font-semibold text-main-100 first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-4 list-disc space-y-1.5 pl-6 marker:text-main-500">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-4 list-decimal space-y-1.5 pl-6 marker:font-medium marker:text-main-500">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="pl-1">{children}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-main-50">{children}</strong>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="my-4 border-l-2 border-accent-medium/60 bg-main-800/30 py-2 pl-4 pr-3 text-main-400">
      {children}
    </blockquote>
  ),
  code: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
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
  table: ({ children }: { children?: ReactNode }) => (
    <div className="my-5 overflow-x-auto rounded-xl ring-1 ring-main-700/45">
      <table className="w-full min-w-lg border-collapse text-left text-[13px]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: ReactNode }) => (
    <thead className="bg-main-800/80 text-main-200">{children}</thead>
  ),
  tbody: ({ children }: { children?: ReactNode }) => (
    <tbody className="divide-y divide-main-700/35">{children}</tbody>
  ),
  tr: ({ children }: { children?: ReactNode }) => (
    <tr className="transition-colors hover:bg-main-800/30">{children}</tr>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border-r border-main-700/35 px-4 py-3 text-xs font-semibold last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border-r border-main-700/25 px-4 py-3 align-top last:border-r-0">
      {children}
    </td>
  ),
  hr: () => <hr className="my-6 border-main-700/40" />,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent-light underline decoration-accent-medium/40 underline-offset-2 transition-colors hover:text-main-50"
    >
      {children}
    </a>
  ),
};
