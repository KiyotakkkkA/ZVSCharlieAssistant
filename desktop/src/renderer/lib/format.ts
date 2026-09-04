export function formatBytes(value: number | null): string {
  if (!value) return "—";
  if (value < 1024) return `${value} Б`;
  if (value < 1_048_576) return `${Math.round(value / 1024)} КБ`;
  if (value < 1_073_741_824) return `${(value / 1_048_576).toFixed(1)} МБ`;
  return `${(value / 1_073_741_824).toFixed(2)} ГБ`;
}

export function formatSize(bytes: number): string {
  if (bytes <= 0) return "Размер не указан";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} ${units[index]}`;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds} с`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин ${seconds % 60} с`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин`;
  return `${Math.floor(hours / 24)} д ${hours % 24} ч`;
}

export function formatMs(ms: number): string {
  if (ms < 1_000) return `${Math.max(0, Math.round(ms))} мс`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} с`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1_000);
  return `${minutes} мин ${seconds} с`;
}

export function formatRemaining(expiresAt: string, now: number): string | null {
  const left = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(left)) return null;
  if (left <= 0) return "срок истёк";
  const minutes = Math.floor(left / 60_000);
  const seconds = Math.floor((left % 60_000) / 1_000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDate(value: string): string {
  const normalized = value.includes("T")
    ? value
    : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(date);
}

export function formatUpdatedAt(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatTokens(value: number): string {
  if (value < 1_000) return String(value);
  return `${(value / 1_000).toFixed(1)}k`;
}

export function formatContext(tokens: number): string {
  return tokens >= 1000
    ? `${Math.round(tokens / 1000)}K контекст`
    : `${tokens} токенов`;
}

export function formatPlatform(platform: string): string {
  if (platform === "win32") return "Windows";
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "Linux";
  return platform;
}

export function formatNodeValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (
    typeof value === "object" &&
    typeof (value as Record<string, unknown>).text === "string"
  )
    return String((value as Record<string, unknown>).text);
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
