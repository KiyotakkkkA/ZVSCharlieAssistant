import {
  DOWNLOAD_CATALOG,
  catalogEntry,
  isBusy,
  type DownloadComponent,
  type DownloadId,
  type DownloadItem,
  type DownloadsSnapshot,
  type DownloadState,
} from "../../../shared/models/downloads";

export interface DownloadGroupStatus {
  id: string;
  installed: boolean;
  downloadBytes: number;
  sizeBytes: number;
  directory: string;
  components: DownloadComponent[];
}

export interface DownloadProgressEvent {
  key: string;
  stage: "downloading" | "unpacking" | "ready";
  downloaded: number;
  total: number | null;
  percent: number | null;
}

export interface DownloadBackend {
  status(): DownloadGroupStatus[];
  start(
    id: DownloadId,
    onProgress: (progress: DownloadProgressEvent) => void,
  ): Promise<void>;
  cancel(id: DownloadId): void;
  remove(id: DownloadId): DownloadGroupStatus[];
  reveal(directory: string): void;
}

interface Runtime {
  state: DownloadState;
  receivedBytes: number;
  totalBytes: number | null;
  percent: number | null;
  activeComponent: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

const IDLE: Runtime = {
  state: "absent",
  receivedBytes: 0,
  totalBytes: null,
  percent: null,
  activeComponent: null,
  startedAt: null,
  finishedAt: null,
  error: null,
};

export const CANCELLED_MESSAGE = "Загрузка отменена";

export interface DownloadFinishedEvent {
  id: DownloadId;
  label: string;
  succeeded: boolean;
  cancelled: boolean;
  sizeBytes: number;
  elapsedMs: number;
  error: string | null;
}

export class DownloadManagerService {
  private readonly runtime = new Map<DownloadId, Runtime>();
  private readonly queue: DownloadId[] = [];
  private running?: DownloadId;

  constructor(
    private readonly backend: DownloadBackend,
    private readonly onChange: (snapshot: DownloadsSnapshot) => void,
    private readonly onFinished?: (event: DownloadFinishedEvent) => void,
  ) {}

  snapshot(): DownloadsSnapshot {
    const status = new Map(
      this.safeStatus().map((group) => [group.id, group] as const),
    );
    const items: DownloadItem[] = DOWNLOAD_CATALOG.map((entry) => {
      const group = status.get(entry.id);
      const runtime = this.runtime.get(entry.id) ?? IDLE;
      const installed = group?.installed ?? false;
      return {
        ...entry,
        installed,
        state: resolveState(runtime.state, installed),
        downloadBytes: group?.downloadBytes ?? 0,
        sizeBytes: group?.sizeBytes ?? 0,
        directory: group?.directory ?? "",
        components: group?.components ?? [],
        receivedBytes: runtime.receivedBytes,
        totalBytes: runtime.totalBytes,
        percent: runtime.percent,
        activeComponent: runtime.activeComponent,
        startedAt: runtime.startedAt,
        finishedAt: runtime.finishedAt,
        error: runtime.error,
      };
    });
    return {
      items,
      activeCount: items.filter((item) => item.state === "downloading").length,
      queuedCount: items.filter((item) => item.state === "queued").length,
    };
  }

  start(id: DownloadId): DownloadsSnapshot {
    catalogEntry(id);
    const current = this.runtime.get(id);
    if (current && isBusy(current.state)) return this.snapshot();
    this.runtime.set(id, {
      ...IDLE,
      state: "queued",
      startedAt: Date.now(),
    });
    this.queue.push(id);
    this.publish();
    this.drain();
    return this.snapshot();
  }

  cancel(id: DownloadId): DownloadsSnapshot {
    const queued = this.queue.indexOf(id);
    if (queued >= 0) {
      this.queue.splice(queued, 1);
      this.finish(id, "cancelled", CANCELLED_MESSAGE);
      return this.snapshot();
    }
    if (this.running === id) this.backend.cancel(id);
    return this.snapshot();
  }

  remove(id: DownloadId): DownloadsSnapshot {
    catalogEntry(id);
    const current = this.runtime.get(id);
    if (current && isBusy(current.state))
      throw new Error(
        "Дождитесь окончания загрузки или отмените её, прежде чем удалять файлы",
      );
    this.backend.remove(id);
    this.runtime.delete(id);
    this.publish();
    return this.snapshot();
  }

  reveal(id: DownloadId): void {
    const item = this.snapshot().items.find((entry) => entry.id === id);
    if (!item?.directory) throw new Error("Папка загрузки ещё не создана");
    this.backend.reveal(item.directory);
  }

  private drain(): void {
    if (this.running || !this.queue.length) return;
    const id = this.queue.shift()!;
    this.running = id;
    this.update(id, { state: "downloading" });
    void this.backend
      .start(id, (progress) => this.report(id, progress))
      .then(() => this.finish(id, "installed", null))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.finish(
          id,
          message.includes(CANCELLED_MESSAGE) ? "cancelled" : "failed",
          message,
        );
      })
      .finally(() => {
        this.running = undefined;
        this.drain();
      });
  }

  private report(id: DownloadId, progress: DownloadProgressEvent): void {
    this.update(id, {
      state: progress.stage === "unpacking" ? "unpacking" : "downloading",
      receivedBytes: progress.downloaded,
      totalBytes: progress.total,
      percent: progress.percent,
      activeComponent: progress.key,
    });
  }

  private finish(
    id: DownloadId,
    state: DownloadState,
    error: string | null,
  ): void {
    const startedAt = this.runtime.get(id)?.startedAt ?? Date.now();
    this.update(id, {
      state,
      error,
      finishedAt: Date.now(),
      activeComponent: null,
      percent: state === "installed" ? 100 : null,
    });
    const item = this.snapshot().items.find((entry) => entry.id === id);
    this.onFinished?.({
      id,
      label: item?.label ?? id,
      succeeded: state === "installed",
      cancelled: state === "cancelled",
      sizeBytes: item?.sizeBytes ?? 0,
      elapsedMs: Date.now() - startedAt,
      error,
    });
  }

  private update(id: DownloadId, patch: Partial<Runtime>): void {
    this.runtime.set(id, { ...(this.runtime.get(id) ?? IDLE), ...patch });
    this.publish();
  }

  private publish(): void {
    this.onChange(this.snapshot());
  }

  private safeStatus(): DownloadGroupStatus[] {
    try {
      return this.backend.status();
    } catch (error) {
      console.error("Не удалось прочитать состояние загрузок", error);
      return [];
    }
  }
}

function resolveState(state: DownloadState, installed: boolean): DownloadState {
  if (isBusy(state)) return state;
  if (installed) return "installed";
  if (state === "installed") return "absent";
  return state === "absent" ? "absent" : state;
}
