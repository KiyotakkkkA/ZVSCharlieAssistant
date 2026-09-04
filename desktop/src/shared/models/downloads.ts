export const DOWNLOAD_IDS = ["ocr", "embedding", "cuda"] as const;
export type DownloadId = (typeof DOWNLOAD_IDS)[number];

export const DOWNLOAD_CATEGORIES = ["models", "gpu", "other"] as const;
export type DownloadCategory = (typeof DOWNLOAD_CATEGORIES)[number];

export type DownloadState =
  | "absent"
  | "queued"
  | "downloading"
  | "unpacking"
  | "installed"
  | "failed"
  | "cancelled";

export interface DownloadCatalogEntry {
  id: DownloadId;
  category: DownloadCategory;
  label: string;
  purpose: string;
  required: boolean;
}

export const DOWNLOAD_CATEGORY_LABELS: Record<DownloadCategory, string> = {
  models: "Модели",
  gpu: "Видеокарта",
  other: "Прочее",
};

export const DOWNLOAD_CATALOG: readonly DownloadCatalogEntry[] = [
  {
    id: "ocr",
    category: "models",
    label: "Распознавание сканов",
    purpose:
      "Без этих моделей не получится распознавать текст на сканах и изображениях.",
    required: true,
  },
  {
    id: "embedding",
    category: "models",
    label: "Модель поиска по смыслу (bge-m3)",
    purpose:
      "Ищет документы по смыслу прямо на этом компьютере, без обращения к внешним сервисам.",
    required: false,
  },
  {
    id: "cuda",
    category: "gpu",
    label: "Библиотеки NVIDIA (CUDA)",
    purpose:
      "Нужны, только если в настройках базы знаний выбран способ обработки «Видеокарта NVIDIA».",
    required: false,
  },
];

export interface DownloadComponent {
  key: string;
  present: boolean;
  sizeBytes: number | null;
  sourceUrl: string;
  path: string;
}

export interface DownloadItem extends DownloadCatalogEntry {
  state: DownloadState;
  installed: boolean;
  downloadBytes: number;
  sizeBytes: number;
  directory: string;
  components: DownloadComponent[];
  receivedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  activeComponent: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

export interface DownloadsSnapshot {
  items: DownloadItem[];
  activeCount: number;
  queuedCount: number;
}

export function catalogEntry(id: DownloadId): DownloadCatalogEntry {
  const entry = DOWNLOAD_CATALOG.find((item) => item.id === id);
  if (!entry) throw new Error(`Неизвестная загрузка «${id}»`);
  return entry;
}

export function isDownloadId(value: unknown): value is DownloadId {
  return (DOWNLOAD_IDS as readonly unknown[]).includes(value);
}

export function isBusy(state: DownloadState): boolean {
  return state === "queued" || state === "downloading" || state === "unpacking";
}
