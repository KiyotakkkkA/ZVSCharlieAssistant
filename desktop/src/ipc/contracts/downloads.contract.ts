import type {
  DownloadId,
  DownloadsSnapshot,
} from "../../shared/models/downloads";

export interface DownloadsApi {
  getSnapshot(): Promise<DownloadsSnapshot>;
  start(id: DownloadId): Promise<DownloadsSnapshot>;
  cancel(id: DownloadId): Promise<DownloadsSnapshot>;
  remove(id: DownloadId): Promise<DownloadsSnapshot>;
  reveal(id: DownloadId): Promise<void>;
  subscribe(listener: (snapshot: DownloadsSnapshot) => void): () => void;
}

export const DOWNLOADS_IPC_CHANNELS = {
  getSnapshot: "downloads:get-snapshot",
  start: "downloads:start",
  cancel: "downloads:cancel",
  remove: "downloads:remove",
  reveal: "downloads:reveal",
  changed: "downloads:changed",
} as const;

export type {
  DownloadCategory,
  DownloadComponent,
  DownloadId,
  DownloadItem,
  DownloadState,
  DownloadsSnapshot,
} from "../../shared/models/downloads";
