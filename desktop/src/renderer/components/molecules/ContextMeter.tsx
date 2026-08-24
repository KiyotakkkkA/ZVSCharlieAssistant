import { Badge, Button, Tooltip } from "@kiyotakkkka/zvs-uikit-lib";
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

  const used = window?.usedTokens ?? 0;
  const usable = window?.usableTokens ?? 1;
  const ratio = Math.min(1, used / Math.max(1, usable));
  const thresholdRatio = window
    ? Math.min(1, window.compactAtTokens / Math.max(1, usable))
    : 0.78;
  const nearLimit = window ? used >= window.compactAtTokens : false;
  const lastSwitch = switches[switches.length - 1];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-main-700/40 px-4 py-2 text-xs text-main-400">
      {window ? (
        <div
          className="flex min-w-45 flex-1 items-center gap-2"
          title={`Порог автоматического сжатия: ${Math.round(thresholdRatio * 100)}% окна модели`}
        >
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
            />
          </div>
          <span className="whitespace-nowrap tabular-nums">
            {formatTokens(used)} / {formatTokens(usable)}
            {window.estimated ? " (оценка)" : ""}
          </span>
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        rounded="rounded-lg"
        className="border-0! shadow-none ring-0! hover:bg-main-700/45"
        disabled={disabled || compacting}
        loading={compacting}
        loadingText="Сжимаю..."
        onClick={onCompact}
      >
        Сжать контекст
      </Button>

      {segments.length ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          rounded="rounded-lg"
          className="border-0! shadow-none ring-0! hover:bg-main-700/45"
          onClick={onToggleCompacted}
        >
          {showCompacted
            ? "Скрыть сжатое"
            : `Сжато: ${compactedCount(segments)}`}
        </Button>
      ) : null}

      {lastSwitch ? (
        <Tooltip label={lastSwitch.detail} placement="top-left">
          <Badge variant="warning">
            {modelLabel(lastSwitch.from)} → {modelLabel(lastSwitch.to)}:{" "}
            {SWITCH_REASONS[lastSwitch.reason]}
            {switches.length > 1 ? ` (+${switches.length - 1})` : ""}
          </Badge>
        </Tooltip>
      ) : null}

      {editsCount ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          rounded="rounded-lg"
          className="border-0! text-accent-light shadow-none ring-0! hover:bg-main-700/45"
          onClick={onOpenEdits}
        >
          Правки файлов: {editsCount}
        </Button>
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
