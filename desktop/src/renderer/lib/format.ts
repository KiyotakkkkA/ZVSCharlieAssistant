export function formatBytes(value: number | null): string {
  if (!value) return "—";
  if (value < 1_048_576) return `${Math.round(value / 1024)} КБ`;
  if (value < 1_073_741_824) return `${(value / 1_048_576).toFixed(1)} МБ`;
  return `${(value / 1_073_741_824).toFixed(2)} ГБ`;
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
