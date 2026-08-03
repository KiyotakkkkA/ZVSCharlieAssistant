import { ScrollArea, SlidedPanel, Tabs } from "@kiyotakkkka/zvs-uikit-lib";
import { useEffect, useMemo, useState } from "react";
import type { ChatToolCall, ScenarioNodeRun } from "../../../../ipc/contracts";
import { WebIcon } from "../../atoms";

interface InternalChatSource {
  documentId: number;
  fileName: string;
  pages: number[];
  score: number;
  excerpts: string[];
}

interface WebChatSource {
  title: string;
  url: string;
  excerpt: string;
}

export interface ChatSources {
  internal: InternalChatSource[];
  web: WebChatSource[];
}

interface VectorSourceRow {
  documentId: number;
  fileName: string;
  content: string;
  score: number;
  pageNumber: number | null;
}

const toolVectorCache = new WeakMap<ChatToolCall[], VectorSourceRow[]>();
const scenarioSourceCache = new WeakMap<ScenarioNodeRun[], VectorSourceRow[]>();
const webSourceCache = new WeakMap<ChatToolCall[], WebChatSource[]>();
const scenarioWebSourceCache = new WeakMap<
  ScenarioNodeRun[],
  WebChatSource[]
>();

export function collectChatSources(
  toolCalls?: ChatToolCall[],
  scenarioNodes?: ScenarioNodeRun[],
): ChatSources {
  return {
    internal: groupInternalSources([
      ...collectToolVectorRows(toolCalls),
      ...collectScenarioRows(scenarioNodes),
    ]),
    web: mergeWebSources([
      ...collectWebSources(toolCalls),
      ...collectScenarioWebSources(scenarioNodes),
    ]),
  };
}

export function ChatSourcePanel({
  sources,
  onClose,
}: {
  sources: ChatSources;
  onClose: () => void;
}) {
  const tabs = useMemo(
    () => [
      ...(sources.internal.length
        ? [{ value: "internal", label: "Внутреннее хранилище" }]
        : []),
      ...(sources.web.length ? [{ value: "web", label: "Веб-ресурсы" }] : []),
    ],
    [sources.internal.length, sources.web.length],
  );
  const [selectedTab, setSelectedTab] = useState("internal");
  useEffect(() => {
    if (!tabs.some((tab) => tab.value === selectedTab))
      setSelectedTab(tabs[0]?.value ?? "internal");
  }, [selectedTab, tabs]);

  return (
    <SlidedPanel
      open={tabs.length > 0}
      onClose={onClose}
      panelPlacement="right"
      className="w-full max-w-xl bg-main-900"
    >
      <SlidedPanel.Header>
        <SlidedPanel.Title>Источники ответа</SlidedPanel.Title>
        <SlidedPanel.Subtitle>
          Внешние данные, использованные при подготовке ответа
        </SlidedPanel.Subtitle>
      </SlidedPanel.Header>
      <SlidedPanel.Content className="flex min-h-0 flex-col gap-4">
        <Tabs value={selectedTab} onChange={setSelectedTab} options={tabs} />
        <ScrollArea className="pr-1 space-y-2">
          {selectedTab === "web"
            ? sources.web.map((source) => (
                <WebSourceCard key={source.url} source={source} />
              ))
            : sources.internal.map((source) => (
                <InternalSourceCard
                  key={source.documentId}
                  source={source}
                  onOpen={onClose}
                />
              ))}
        </ScrollArea>
      </SlidedPanel.Content>
    </SlidedPanel>
  );
}

function InternalSourceCard({
  source,
  onOpen,
}: {
  source: InternalChatSource;
  onOpen: () => void;
}) {
  return (
    <a
      href={`#/storage/vector-db?documentId=${source.documentId}`}
      className="group block rounded-xl bg-main-800/55 p-4 ring-1 ring-main-700/35 transition-colors hover:bg-main-700/60"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-main-100 group-hover:text-main-50">
            {source.fileName}
          </p>
          <p className="mt-1 text-[11px] text-main-500">
            {source.pages.length
              ? `Страницы: ${source.pages.join(", ")}`
              : "Документ"}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-accent-light">
          {Math.round(source.score * 100)}%
        </span>
      </div>
      {source.excerpts[0] ? (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-main-400">
          {source.excerpts[0]}
        </p>
      ) : null}
    </a>
  );
}

function WebSourceCard({ source }: { source: WebChatSource }) {
  const hostname = safeHostname(source.url);
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="group block rounded-xl bg-main-800/55 p-4 ring-1 ring-main-700/35 transition-colors hover:bg-main-700/60"
    >
      <div className="flex items-start gap-3">
        <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-main-700/55 text-main-400">
          {faviconUrl(source.url) ? (
            <img
              src={faviconUrl(source.url)}
              alt=""
              className="absolute inset-0 size-full object-contain p-2"
              onError={(event) => event.currentTarget.remove()}
            />
          ) : (
            <WebIcon className="size-4" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-main-100 group-hover:text-main-50">
            {source.title}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-accent-light">
            {hostname}
          </span>
        </span>
      </div>
      {source.excerpt ? (
        <p className="mt-3 line-clamp-3 text-xs leading-5 text-main-400">
          {source.excerpt}
        </p>
      ) : null}
    </a>
  );
}

function groupInternalSources(rows: VectorSourceRow[]) {
  const grouped = new Map<
    number,
    InternalChatSource & { pageSet: Set<number> }
  >();
  for (const row of rows) {
    const current = grouped.get(row.documentId) ?? {
      documentId: row.documentId,
      fileName: row.fileName,
      pages: [],
      pageSet: new Set<number>(),
      score: row.score,
      excerpts: [],
    };
    if (row.pageNumber !== null) current.pageSet.add(row.pageNumber);
    current.score = Math.max(current.score, row.score);
    if (row.content && !current.excerpts.includes(row.content))
      current.excerpts.push(row.content);
    grouped.set(row.documentId, current);
  }
  return [...grouped.values()]
    .map(({ pageSet, ...source }) => ({
      ...source,
      excerpts: source.excerpts.slice(0, 3),
      pages: [...pageSet].sort((left, right) => left - right),
    }))
    .sort((left, right) => right.score - left.score);
}

function collectToolVectorRows(toolCalls?: ChatToolCall[]) {
  if (!toolCalls?.length) return [];
  const cached = toolVectorCache.get(toolCalls);
  if (cached) return cached;
  const rows = toolCalls.flatMap((call) =>
    call.toolId === "vecdb_search" &&
    call.status === "completed" &&
    Array.isArray(call.output)
      ? call.output.filter(isVectorSource)
      : [],
  );
  toolVectorCache.set(toolCalls, rows);
  return rows;
}

function collectWebSources(toolCalls?: ChatToolCall[]) {
  if (!toolCalls?.length) return [];
  const cached = webSourceCache.get(toolCalls);
  if (cached) return cached;
  const sources = new Map<string, WebChatSource>();
  for (const call of toolCalls) {
    if (call.status !== "completed") continue;
    if (call.toolId === "web_search") {
      const output = asRecord(call.output);
      const results = Array.isArray(output?.results) ? output.results : [];
      for (const result of results) {
        const row = asRecord(result);
        addWebSource(sources, row?.url, row?.title, row?.content);
      }
    } else if (call.toolId === "web_fetch") {
      const output = asRecord(call.output);
      const input = asRecord(call.input);
      addWebSource(sources, input?.url, output?.title, output?.content);
    }
  }
  const result = [...sources.values()];
  webSourceCache.set(toolCalls, result);
  return result;
}

function collectScenarioWebSources(nodes?: ScenarioNodeRun[]) {
  if (!nodes?.length) return [];
  const cached = scenarioWebSourceCache.get(nodes);
  if (cached) return cached;
  const sources = new Map<string, WebChatSource>();
  for (const node of nodes) {
    if (node.nodeKind !== "agent") continue;
    const output = asRecord(node.output);
    const rows = Array.isArray(output?.webSources) ? output.webSources : [];
    for (const value of rows) {
      const row = asRecord(value);
      addWebSource(sources, row?.url, row?.title, row?.content);
    }
  }
  const result = [...sources.values()];
  scenarioWebSourceCache.set(nodes, result);
  return result;
}

function mergeWebSources(sources: WebChatSource[]) {
  return [...new Map(sources.map((source) => [source.url, source])).values()];
}

function addWebSource(
  sources: Map<string, WebChatSource>,
  rawUrl: unknown,
  rawTitle: unknown,
  rawExcerpt: unknown,
) {
  if (typeof rawUrl !== "string") return;
  const url = normalizeUrl(rawUrl);
  if (!url || sources.has(url)) return;
  sources.set(url, {
    url,
    title:
      typeof rawTitle === "string" && rawTitle.trim()
        ? rawTitle.trim()
        : safeHostname(url),
    excerpt: typeof rawExcerpt === "string" ? rawExcerpt.trim() : "",
  });
}

function collectScenarioRows(nodes?: ScenarioNodeRun[]) {
  if (!nodes?.length) return [];
  const cached = scenarioSourceCache.get(nodes);
  if (cached) return cached;
  const rows = nodes.flatMap((node) => {
    if (node.nodeKind !== "agent") return [];
    const output = asRecord(node.output);
    const input = asRecord(node.input);
    const sources = output?.sources ?? input?.knowledge;
    return Array.isArray(sources) ? sources.filter(isVectorSource) : [];
  });
  scenarioSourceCache.set(nodes, rows);
  return rows;
}

function isVectorSource(value: unknown): value is VectorSourceRow {
  const row = asRecord(value);
  return Boolean(
    row &&
    Number.isInteger(row.documentId) &&
    typeof row.fileName === "string" &&
    typeof row.content === "string" &&
    typeof row.score === "number" &&
    (row.pageNumber === null || Number.isInteger(row.pageNumber)),
  );
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeUrl(value: string) {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      .href;
  } catch {
    return "";
  }
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function faviconUrl(value: string) {
  try {
    return `${new URL(value).origin}/favicon.ico`;
  } catch {
    return "";
  }
}
