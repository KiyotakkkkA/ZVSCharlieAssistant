import { shell } from "electron";
import type { NativeIndexerService } from "../vector-store/native-indexer.service";
import type { DownloadId } from "../../../shared/models/downloads";
import type {
  DownloadBackend,
  DownloadGroupStatus,
  DownloadProgressEvent,
} from "./download-manager.service";

export class AddonDownloadBackend implements DownloadBackend {
  constructor(private readonly indexer: NativeIndexerService) {}

  status(): DownloadGroupStatus[] {
    return this.indexer.downloadStatus();
  }

  start(
    id: DownloadId,
    onProgress: (progress: DownloadProgressEvent) => void,
  ): Promise<void> {
    return this.indexer.startDownload(id, onProgress);
  }

  cancel(id: DownloadId): void {
    this.indexer.cancelDownload(id);
  }

  remove(id: DownloadId): DownloadGroupStatus[] {
    return this.indexer.deleteDownload(id);
  }

  reveal(directory: string): void {
    void shell.openPath(directory);
  }
}
