import type { ChatToolCall } from "../../../../ipc/contracts";
import { BrainIcon } from "../../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

const MEMORY_KIND_LABELS: Record<string, string> = {
  fact: "Факт",
  preference: "Предпочтение",
  instruction: "Указание",
  episode: "Событие",
};

export function CompactToolMemoryBlock({ call }: { call: ChatToolCall }) {
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
        <MemoryToolDetails call={call} saving={saving} />
      </CompactToolStatus.Expandable>
    </CompactToolStatus>
  );
}

function MemoryToolDetails({
  call,
  saving,
}: {
  call: ChatToolCall;
  saving: boolean;
}) {
  const input = isRecord(call.input) ? call.input : {};

  if (saving) {
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
