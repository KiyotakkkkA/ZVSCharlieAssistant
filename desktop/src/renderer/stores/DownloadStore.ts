import { makeAutoObservable, runInAction } from "mobx";
import {
  DOWNLOAD_CATALOG,
  isBusy,
  type DownloadCategory,
  type DownloadId,
  type DownloadItem,
  type DownloadsSnapshot,
} from "../../shared/models/downloads";

const PLACEHOLDER: DownloadItem[] = DOWNLOAD_CATALOG.map((entry) => ({
  ...entry,
  state: "absent",
  installed: false,
  downloadBytes: 0,
  sizeBytes: 0,
  directory: "",
  components: [],
  receivedBytes: 0,
  totalBytes: null,
  percent: null,
  activeComponent: null,
  startedAt: null,
  finishedAt: null,
  error: null,
}));

export class DownloadStore {
  items: DownloadItem[] = PLACEHOLDER;
  initialized = false;
  private watcher?: () => void;

  constructor() {
    makeAutoObservable<this, "watcher">(
      this,
      { watcher: false },
      { autoBind: true },
    );
  }

  get busy(): DownloadItem[] {
    return this.items.filter((item) => isBusy(item.state));
  }

  get failed(): DownloadItem[] {
    return this.items.filter((item) => item.state === "failed");
  }

  get pending(): DownloadItem[] {
    return this.items.filter((item) => !item.installed && !isBusy(item.state));
  }

  get pendingBytes(): number {
    return this.pending.reduce((sum, item) => sum + item.downloadBytes, 0);
  }

  get overallPercent(): number | null {
    const active = this.busy;
    if (!active.length) return null;
    const known = active.filter((item) => item.percent !== null);
    if (!known.length) return 0;
    return Math.round(
      known.reduce((sum, item) => sum + (item.percent ?? 0), 0) / known.length,
    );
  }

  byCategory(category: DownloadCategory): DownloadItem[] {
    return this.items.filter((item) => item.category === category);
  }

  find(id: DownloadId): DownloadItem {
    return this.items.find((item) => item.id === id) ?? PLACEHOLDER[0]!;
  }

  async bootstrap(force = false) {
    if (this.initialized && !force) return;
    this.watch();
    const snapshot = await window.desktop.downloads.getSnapshot();
    this.apply(snapshot);
  }

  async start(id: DownloadId) {
    this.apply(await window.desktop.downloads.start(id));
  }

  async cancel(id: DownloadId) {
    this.apply(await window.desktop.downloads.cancel(id));
  }

  async remove(id: DownloadId) {
    this.apply(await window.desktop.downloads.remove(id));
  }

  reveal(id: DownloadId) {
    void window.desktop.downloads.reveal(id);
  }

  private watch() {
    if (this.watcher) return;
    this.watcher = window.desktop.downloads.subscribe?.((snapshot) =>
      this.apply(snapshot),
    );
  }

  private apply(snapshot: DownloadsSnapshot) {
    runInAction(() => {
      this.items = snapshot.items;
      this.initialized = true;
    });
  }
}

export const downloadStore = new DownloadStore();
