import { SlidedPanel, Tabs } from "@kiyotakkkka/zvs-uikit-lib";
import type { ChatToolCall, ScenarioNodeRun } from "../../../ipc/contracts";

const SOURCE_TABS = [{ value: "internal", label: "Внутреннее хранилище" }];

export interface ChatSource {
  documentId: number;
  fileName: string;
  pages: number[];
  score: number;
  excerpts: string[];
}

interface VectorSourceRow {
  documentId: number;
  fileName: string;
  content: string;
  score: number;
  pageNumber: number | null;
}

const toolSourceCache = new WeakMap<ChatToolCall[], VectorSourceRow[]>();
const scenarioSourceCache = new WeakMap<ScenarioNodeRun[], VectorSourceRow[]>();

export function collectChatSources(
  toolCalls?: ChatToolCall[],
  scenarioNodes?: ScenarioNodeRun[],
): ChatSource[] {
  const rows = [
    ...collectToolRows(toolCalls),
    ...collectScenarioRows(scenarioNodes),
  ];
  const grouped = new Map<number, ChatSource & { pageSet: Set<number> }>();
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

export function ChatSourcePanel({
  sources,
  onClose,
}: {
  sources: ChatSource[];
  onClose: () => void;
}) {
  return (
    <SlidedPanel
      open={sources.length > 0}
      onClose={onClose}
      panelPlacement="right"
      className="w-full max-w-xl bg-main-900"
    >
      <SlidedPanel.Header>
        <SlidedPanel.Title>Источники ответа</SlidedPanel.Title>
        <SlidedPanel.Subtitle>
          Внешние данные, используемые для ответа
        </SlidedPanel.Subtitle>
      </SlidedPanel.Header>
      <SlidedPanel.Content className="flex min-h-0 flex-col gap-4">
        <Tabs
          value="internal"
          onChange={() => undefined}
          options={SOURCE_TABS}
        />
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
          {sources.map((source) => (
            <a
              key={source.documentId}
              href={`#/storage/vector-db?documentId=${source.documentId}`}
              className="group block rounded-xl bg-main-800/55 p-4 ring-1 ring-main-700/35 transition-colors hover:bg-main-700/60"
              onClick={onClose}
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
          ))}
        </div>
      </SlidedPanel.Content>
    </SlidedPanel>
  );
}

function collectToolRows(toolCalls?: ChatToolCall[]) {
  if (!toolCalls?.length) return [];
  const cached = toolSourceCache.get(toolCalls);
  if (cached) return cached;
  const rows = toolCalls.flatMap((call) =>
    call.toolId === "vecdb.search" &&
    call.status === "completed" &&
    Array.isArray(call.output)
      ? call.output.filter(isVectorSource)
      : [],
  );
  toolSourceCache.set(toolCalls, rows);
  return rows;
}

function collectScenarioRows(nodes?: ScenarioNodeRun[]) {
  if (!nodes?.length) return [];
  const cached = scenarioSourceCache.get(nodes);
  if (cached) return cached;
  const rows = nodes.flatMap((node) => {
    if (node.nodeKind !== "agent") return [];
    const output =
      node.output && typeof node.output === "object"
        ? (node.output as Record<string, unknown>)
        : undefined;
    const input =
      node.input && typeof node.input === "object"
        ? (node.input as Record<string, unknown>)
        : undefined;
    const sources = output?.sources ?? input?.knowledge;
    return Array.isArray(sources) ? sources.filter(isVectorSource) : [];
  });
  scenarioSourceCache.set(nodes, rows);
  return rows;
}

function isVectorSource(value: unknown): value is VectorSourceRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    Number.isInteger(row.documentId) &&
    typeof row.fileName === "string" &&
    typeof row.content === "string" &&
    typeof row.score === "number" &&
    (row.pageNumber === null || Number.isInteger(row.pageNumber))
  );
}
