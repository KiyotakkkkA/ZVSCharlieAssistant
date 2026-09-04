import { useCallback, useEffect } from "react";
import { downloadStore } from "../stores/DownloadStore";
import {
  isBusy,
  type DownloadCategory,
  type DownloadId,
  type DownloadItem,
} from "../../shared/models/downloads";

export interface DownloadHandle {
  item: DownloadItem;
  installed: boolean;
  busy: boolean;
  percent: number | null;
  error: string | null;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
  remove: () => Promise<void>;
  reveal: () => void;
}

export function useDownload(id: DownloadId): DownloadHandle {
  useEffect(() => {
    void downloadStore.bootstrap();
  }, []);

  const item = downloadStore.find(id);
  const start = useCallback(() => downloadStore.start(id), [id]);
  const cancel = useCallback(() => downloadStore.cancel(id), [id]);
  const remove = useCallback(() => downloadStore.remove(id), [id]);
  const reveal = useCallback(() => downloadStore.reveal(id), [id]);

  return {
    item,
    installed: item.installed,
    busy: isBusy(item.state),
    percent: item.percent,
    error: item.error,
    start,
    cancel,
    remove,
    reveal,
  };
}

export function useDownloads(category?: DownloadCategory): DownloadItem[] {
  useEffect(() => {
    void downloadStore.bootstrap();
  }, []);
  return category ? downloadStore.byCategory(category) : downloadStore.items;
}

export function useDownloadActivity() {
  useEffect(() => {
    void downloadStore.bootstrap();
  }, []);
  return {
    busy: downloadStore.busy,
    failed: downloadStore.failed,
    pending: downloadStore.pending,
    pendingBytes: downloadStore.pendingBytes,
    overallPercent: downloadStore.overallPercent,
  };
}
