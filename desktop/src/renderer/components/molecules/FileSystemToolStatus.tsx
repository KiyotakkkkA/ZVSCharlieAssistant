import type { ChatToolCall } from "../../../ipc/contracts";
import {
  FileDocumentMultipleIcon,
  FileEditIcon,
  FileEyeIcon,
  FileMoveIcon,
  FilePlusIcon,
  FileRemoveIcon,
  FileSyncIcon,
  FolderSearchIcon,
  type SvgIcon,
} from "../atoms";
import { CompactToolStatus } from "./CompactToolStatus";

const FILE_SYSTEM_TOOL_IDS = [
  "fs_read",
  "fs_list",
  "fs_write",
  "fs_edit",
  "fs_multi_edit",
  "fs_apply_patch",
  "fs_move",
  "fs_delete",
] as const;

type FileSystemToolId = (typeof FILE_SYSTEM_TOOL_IDS)[number];

interface ToolPresentation {
  icon: SvgIcon;
  action: string;
  running: string;
  completed: string;
}

const PRESENTATION: Record<FileSystemToolId, ToolPresentation> = {
  fs_read: {
    icon: FileEyeIcon,
    action: "Чтение файла",
    running: "Читает",
    completed: "Прочитан",
  },
  fs_list: {
    icon: FolderSearchIcon,
    action: "Структура директории",
    running: "Просматривает",
    completed: "Просмотрена",
  },
  fs_write: {
    icon: FilePlusIcon,
    action: "Запись файла",
    running: "Записывает",
    completed: "Записан",
  },
  fs_edit: {
    icon: FileEditIcon,
    action: "Правка файла",
    running: "Изменяет",
    completed: "Изменён",
  },
  fs_multi_edit: {
    icon: FileDocumentMultipleIcon,
    action: "Пакет правок",
    running: "Применяет правки к",
    completed: "Правки применены к",
  },
  fs_apply_patch: {
    icon: FileSyncIcon,
    action: "Применение патча",
    running: "Применяет патч к",
    completed: "Патч применён к",
  },
  fs_move: {
    icon: FileMoveIcon,
    action: "Перемещение файла",
    running: "Перемещает",
    completed: "Перемещён",
  },
  fs_delete: {
    icon: FileRemoveIcon,
    action: "Удаление файла",
    running: "Удаляет",
    completed: "Перемещён в корзину",
  },
};

export function isFileSystemTool(toolId: string): toolId is FileSystemToolId {
  return (FILE_SYSTEM_TOOL_IDS as readonly string[]).includes(toolId);
}

export function FileSystemToolStatus({ call }: { call: ChatToolCall }) {
  if (!isFileSystemTool(call.toolId)) return null;

  const input = asRecord(call.input);
  const presentation = PRESENTATION[call.toolId];
  const target = shortPath(primaryPath(call.toolId, input));

  return (
    <CompactToolStatus defaultExpanded={call.status === "failed"}>
      <CompactToolStatus.Trigger
        icon={presentation.icon}
        running={`${presentation.running} ${target}`}
        completed={`${presentation.completed} ${target}`}
        failed={`Ошибка при работе с ${target}`}
        status={call.status}
      />
      <CompactToolStatus.Expandable className="p-0!">
        <FileSystemToolDetails
          call={call}
          toolId={call.toolId}
          presentation={presentation}
        />
      </CompactToolStatus.Expandable>
    </CompactToolStatus>
  );
}

function FileSystemToolDetails({
  call,
  toolId,
  presentation,
}: {
  call: ChatToolCall;
  toolId: FileSystemToolId;
  presentation: ToolPresentation;
}) {
  const input = asRecord(call.input);
  const output = asRecord(call.output);
  const path = stringValue(output.path) ?? primaryPath(toolId, input);
  const destination =
    stringValue(output.movedTo) ?? stringValue(input.to) ?? null;
  const metrics = collectMetrics(toolId, input, output);

  return (
    <div className="overflow-hidden rounded-xl">
      <div className="px-4 py-3.5">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-accent-medium/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-light ring-1 ring-accent-medium/15">
            {presentation.action}
          </span>
          <span className="text-[11px] text-main-600">
            {statusLabel(call.status)}
          </span>
        </div>
        <PathLine label={toolId === "fs_move" ? "Откуда" : "Путь"} path={path} />
        {toolId === "fs_move" && destination ? (
          <PathLine label="Куда" path={destination} className="mt-1.5" />
        ) : null}
        {metrics.length ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2 border-t border-main-700/35 pt-3 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="min-w-0">
                <dt className="text-[10px] uppercase tracking-wide text-main-600">
                  {metric.label}
                </dt>
                <dd className="mt-0.5 truncate text-xs font-medium text-main-300">
                  {metric.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {call.error ? (
        <div className="border-t border-danger-medium/20 bg-danger-medium/5 px-4 py-2.5 text-xs leading-5 text-danger-light">
          {call.error}
        </div>
      ) : toolId === "fs_delete" && call.status === "completed" ? (
        <div className="border-t border-main-700/35 px-4 py-2.5 text-[11px] text-main-500">
          Удаление можно отменить откатом правок задачи
        </div>
      ) : null}
    </div>
  );
}

function PathLine({
  label,
  path,
  className = "",
}: {
  label: string;
  path: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-start gap-2 ${className}`}>
      <span className="w-12 shrink-0 text-[11px] text-main-600">{label}</span>
      <span className="min-w-0 break-all font-mono text-xs text-main-200">
        {path}
      </span>
    </div>
  );
}

interface Metric {
  label: string;
  value: string;
}

function collectMetrics(
  toolId: FileSystemToolId,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
): Metric[] {
  if (toolId === "fs_read") {
    const from = numberValue(output.from) ?? (numberValue(input.offset) ?? 0) + 1;
    const outputTo = numberValue(output.to);
    const requestedLimit = numberValue(input.limit);
    const to = outputTo ?? (requestedLimit ? from + requestedLimit - 1 : null);
    return compactMetrics([
      { label: "Строки", value: to ? `${from}–${to}` : `с ${from}` },
      metric("Всего", numberValue(output.totalLines), " строк"),
      booleanMetric("Продолжение", output.truncated, "есть", "не требуется"),
    ]);
  }

  if (toolId === "fs_list") {
    const entries = Array.isArray(output.entries)
      ? output.entries.filter(isRecord)
      : [];
    const files = entries.filter((entry) => entry.type === "file").length;
    const directories = entries.filter((entry) => entry.type === "dir").length;
    return compactMetrics([
      { label: "Найдено", value: `${entries.length} объектов` },
      { label: "Файлы", value: String(files) },
      { label: "Папки", value: String(directories) },
      metric("Глубина", numberValue(input.depth) ?? 2),
      booleanMetric("Список", output.truncated, "усечён", "полный"),
    ]);
  }

  const diff = stringValue(output.diff) ?? stringValue(input.patch) ?? "";
  const changes = diffStats(diff);
  const bytesBefore = numberValue(output.bytesBefore);
  const bytesAfter = numberValue(output.bytesAfter);
  const sizeChange =
    bytesBefore !== null && bytesAfter !== null
      ? `${signed(bytesAfter - bytesBefore)} Б`
      : null;

  if (toolId === "fs_write") {
    const content = stringValue(input.content) ?? "";
    return compactMetrics([
      { label: "Строк", value: String(lineCount(content)) },
      { label: "Размер", value: formatBytes(utf8Size(content)) },
      sizeChange ? { label: "Изменение", value: sizeChange } : null,
    ]);
  }

  if (toolId === "fs_multi_edit") {
    return compactMetrics([
      {
        label: "Правок",
        value: String(Array.isArray(input.edits) ? input.edits.length : 0),
      },
      diffMetric("Добавлено", changes.added),
      diffMetric("Удалено", changes.removed),
      sizeChange ? { label: "Размер", value: sizeChange } : null,
    ]);
  }

  if (toolId === "fs_edit" || toolId === "fs_apply_patch") {
    return compactMetrics([
      diffMetric("Добавлено", changes.added),
      diffMetric("Удалено", changes.removed),
      sizeChange ? { label: "Размер", value: sizeChange } : null,
    ]);
  }

  if (toolId === "fs_move") {
    return compactMetrics([
      bytesBefore === null
        ? null
        : { label: "Размер", value: formatBytes(bytesBefore) },
    ]);
  }

  return compactMetrics([
    bytesBefore === null
      ? null
      : { label: "Размер", value: formatBytes(bytesBefore) },
    { label: "Восстановление", value: "доступно" },
  ]);
}

function primaryPath(
  toolId: FileSystemToolId,
  input: Record<string, unknown>,
) {
  if (toolId === "fs_move") return stringValue(input.from) ?? "файл";
  return stringValue(input.path) ?? "файл";
}

function shortPath(path: string) {
  const normalized = path.replace(/[\\/]+$/, "");
  return normalized.split(/[\\/]/).at(-1) || path;
}

function statusLabel(status: ChatToolCall["status"]) {
  return {
    requested: "Подготовка",
    running: "Выполняется",
    completed: "Готово",
    failed: "Ошибка",
  }[status];
}

function diffStats(diff: string) {
  let added = 0;
  let removed = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added += 1;
    if (line.startsWith("-")) removed += 1;
  }
  return { added, removed };
}

function lineCount(value: string) {
  return value ? value.split(/\r?\n/).length : 0;
}

function utf8Size(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function formatBytes(value: number) {
  if (value < 1_024) return `${value} Б`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} КБ`;
  return `${(value / 1_048_576).toFixed(1)} МБ`;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function metric(label: string, value: number | null, suffix = ""): Metric | null {
  return value === null ? null : { label, value: `${value}${suffix}` };
}

function diffMetric(label: string, value: number): Metric {
  return { label, value: `${value} строк` };
}

function booleanMetric(
  label: string,
  value: unknown,
  whenTrue: string,
  whenFalse: string,
): Metric | null {
  return typeof value === "boolean"
    ? { label, value: value ? whenTrue : whenFalse }
    : null;
}

function compactMetrics(values: Array<Metric | null>): Metric[] {
  return values.filter((value): value is Metric => value !== null);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
