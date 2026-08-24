import type {
  ContextSegment,
  ContextWindow,
  ModelSwitch,
} from "../../../ipc/contracts";

const SWITCH_REASONS: Record<ModelSwitch["reason"], string> = {
  provider_error: "провайдер недоступен",
  rate_limit: "исчерпан лимит",
  auth: "отказ авторизации",
  context_overflow: "переполнен контекст",
  output_limit: "превышен размер ответа",
  manual: "переключено вручную",
};

interface ContextMeterProps {
  window: ContextWindow | null;
  segments: ContextSegment[];
  compacting: boolean;
  disabled: boolean;
  showCompacted: boolean;
  editsCount: number;
  switches: ModelSwitch[];
  modelLabel: (modelId: string) => string;
  onCompact: () => void;
  onToggleCompacted: () => void;
  onOpenEdits: () => void;
}

export function ContextMeter({
  window,
  segments,
  compacting,
  disabled,
  showCompacted,
  editsCount,
  switches,
  modelLabel,
  onCompact,
  onToggleCompacted,
  onOpenEdits,
}: ContextMeterProps) {
  if (!window && !segments.length && !editsCount && !switches.length)
    return null;
  const lastSwitch = switches[switches.length - 1];

  const used = window?.usedTokens ?? 0;
  const usable = window?.usableTokens ?? 1;
  const ratio = Math.min(1, used / Math.max(1, usable));
  const thresholdRatio = window
    ? Math.min(1, window.compactAtTokens / Math.max(1, usable))
    : 0.78;
  const nearLimit = window ? used >= window.compactAtTokens : false;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-main-700/40 px-4 py-2 text-xs text-main-400">
      {window ? (
        <div className="flex min-w-45 flex-1 items-center gap-2">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-main-700/50">
            <div
              className={`h-full rounded-full transition-[width] ${
                nearLimit ? "bg-amber-400" : "bg-accent-light"
              }`}
              style={{ width: `${Math.round(ratio * 100)}%` }}
            />
            <span
              className="absolute top-0 h-full w-px bg-main-300/60"
              style={{ left: `${Math.round(thresholdRatio * 100)}%` }}
              title="Порог автоматического сжатия"
            />
          </div>
          <span className="tabular-nums whitespace-nowrap">
            {formatTokens(used)} / {formatTokens(usable)}
            {window.estimated ? " (оценка)" : ""}
          </span>
        </div>
      ) : null}

      <button
        type="button"
        className="rounded-lg px-2 py-1 text-main-300 transition-colors hover:bg-main-700/45 hover:text-main-50 disabled:opacity-50"
        disabled={disabled || compacting}
        onClick={onCompact}
        title="Сжать историю диалога, сохранив исходные сообщения"
      >
        {compacting ? "Сжимаю…" : "Сжать контекст"}
      </button>

      {segments.length ? (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-main-300 transition-colors hover:bg-main-700/45 hover:text-main-50"
          onClick={onToggleCompacted}
        >
          {showCompacted
            ? "Скрыть сжатое"
            : `Сжато: ${compactedCount(segments)}`}
        </button>
      ) : null}

      {lastSwitch ? (
        <span
          className="rounded-lg bg-amber-400/10 px-2 py-1 text-amber-200"
          title={lastSwitch.detail}
        >
          ⇄ {modelLabel(lastSwitch.from)} → {modelLabel(lastSwitch.to)}:{" "}
          {SWITCH_REASONS[lastSwitch.reason]}
          {switches.length > 1 ? ` (+${switches.length - 1})` : ""}
        </span>
      ) : null}

      {editsCount ? (
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-accent-light transition-colors hover:bg-main-700/45"
          onClick={onOpenEdits}
        >
          Правки файлов: {editsCount}
        </button>
      ) : null}
    </div>
  );
}

function compactedCount(segments: ContextSegment[]): number {
  return segments.reduce((sum, segment) => sum + segment.messageCount, 0);
}

function formatTokens(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(1)}k`;
}
