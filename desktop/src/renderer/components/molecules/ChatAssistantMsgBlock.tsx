import { Accordion, Alert, CodeView, Skeleton } from "@kiyotakkkka/zvs-uikit-lib";
import { isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatToolCall } from "../../../ipc/contracts";
import {
  ChatIcon,
  StorageIcon,
  type SvgIcon,
  WebIcon,
  WordIcon,
} from "../atoms";
import { ControlButton } from "../atoms/buttons";

export interface ChatAssistantMsgBlockProps {
  text: string;
  reasoning?: string;
  status?: "streaming" | "completed" | "failed" | "cancelled";
  error?: string | null;
  toolCalls?: ChatToolCall[];
  beforeContent?: ReactNode;
  actions?: ReactNode;
  disabled?: boolean;
  onCopy?: () => void;
  onDelete?: () => void;
}

export const ChatAssistantMsgBlock = memo(function ChatAssistantMsgBlock({
  text,
  reasoning,
  status,
  error,
  toolCalls,
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
        {reasoning ? (
          <Accordion className="mb-4 overflow-hidden rounded-xl bg-main-800/45 ring-1 ring-main-700/35">
            <Accordion.Summary className="w-full px-3.5 py-2.5 text-left text-xs font-medium text-main-400 transition-colors hover:bg-main-700/30 hover:text-main-200">
              Ход рассуждений
            </Accordion.Summary>
            <Accordion.Content className="border-t border-main-700/30 px-3.5 py-3 text-xs leading-5 text-main-500 whitespace-pre-wrap">
              {reasoning}
            </Accordion.Content>
          </Accordion>
        ) : null}
        {toolCalls?.length ? (
          <div className="mb-4 space-y-2">
            {toolCalls.map((call) => (
              <ToolCallDetails key={call.id} call={call} />
            ))}
          </div>
        ) : null}
        {status === "failed" && error ? (
          <Alert
            variant="danger"
            title="Не удалось получить ответ"
            className="mb-4"
          >
            {error}
          </Alert>
        ) : null}
        {!text && status === "streaming" ? (
          <AssistantSkeleton />
        ) : (
          <MarkdownContent
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {text}
          </MarkdownContent>
        )}
        {actions}
        <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover/message:opacity-100">
          <ControlButton icon="copy" title="Копировать" onClick={onCopy} />
          <ControlButton
            variant="delete"
            icon="trash"
            title="Удалить"
            disabled={disabled}
            onClick={onDelete}
          />
        </div>
      </div>
    </div>
  );
});

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
  if (call.toolId === "web_search" || call.toolId === "web_fetch")
    return (
      <CompactToolStatus
        icon={WebIcon}
        running="Идёт поиск в интернете"
        completed="Выполнен поиск в интернете"
        status={call.status}
      />
    );
  if (call.toolId === "vecdb_search")
    return (
      <CompactToolStatus
        icon={StorageIcon}
        running="Идёт поиск в хранилище"
        completed="Поиск в хранилище завершён"
        status={call.status}
      />
    );
  if (call.toolId === "reports_docx")
    return (
      <CompactToolStatus
        icon={WordIcon}
        running="Идёт создание отчета"
        completed="Отчет DOCX создан"
        status={call.status}
      />
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

function CompactToolStatus({
  icon: Icon,
  running,
  completed,
  status,
}: {
  icon: SvgIcon;
  running: string;
  completed: string;
  status: ChatToolCall["status"];
}) {
  const done = status === "completed" || status === "failed";
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-xs text-main-400">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-main-800/60 text-main-400">
        <Icon className="size-4" />
      </span>
      <span>{done ? completed : running}</span>
    </div>
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
