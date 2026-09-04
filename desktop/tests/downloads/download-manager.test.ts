import { describe, expect, it, vi } from "vitest";
import {
  CANCELLED_MESSAGE,
  DownloadManagerService,
  type DownloadBackend,
  type DownloadGroupStatus,
  type DownloadProgressEvent,
} from "../../src/host/infrastructure/downloads/download-manager.service";
import type {
  DownloadId,
  DownloadsSnapshot,
} from "../../src/shared/models/downloads";

function group(id: string, installed: boolean): DownloadGroupStatus {
  return {
    id,
    installed,
    downloadBytes: 1000,
    sizeBytes: installed ? 900 : 0,
    directory: `cache/${id}`,
    components: [
      {
        key: `${id}-file`,
        present: installed,
        sizeBytes: installed ? 900 : null,
        sourceUrl: `https://example.invalid/${id}`,
        path: `cache/${id}/file`,
      },
    ],
  };
}

function createManager(installed: string[] = []) {
  const releases = new Map<
    string,
    {
      resolve: () => void;
      reject: (error: Error) => void;
      progress: (event: DownloadProgressEvent) => void;
    }
  >();
  const snapshots: DownloadsSnapshot[] = [];
  const backend: DownloadBackend = {
    status: vi.fn(() =>
      ["ocr", "embedding", "cuda"].map((id) =>
        group(id, installed.includes(id)),
      ),
    ),
    start: vi.fn(
      (id: DownloadId, onProgress: (event: DownloadProgressEvent) => void) =>
        new Promise<void>((resolve, reject) => {
          releases.set(id, { resolve, reject, progress: onProgress });
        }),
    ),
    cancel: vi.fn((id: DownloadId) =>
      releases.get(id)?.reject(new Error(CANCELLED_MESSAGE)),
    ),
    remove: vi.fn(() => []),
    reveal: vi.fn(),
  };
  const manager = new DownloadManagerService(backend, (snapshot) =>
    snapshots.push(snapshot),
  );
  return { manager, backend, releases, snapshots };
}

function item(snapshot: DownloadsSnapshot, id: DownloadId) {
  return snapshot.items.find((entry) => entry.id === id)!;
}

describe("DownloadManagerService", () => {
  it("reports what is on disk before anything is started", () => {
    const { manager } = createManager(["ocr"]);

    const snapshot = manager.snapshot();

    expect(item(snapshot, "ocr").state).toBe("installed");
    expect(item(snapshot, "embedding").state).toBe("absent");
    expect(snapshot.items.map((entry) => entry.category)).toEqual([
      "models",
      "models",
      "models",
      "gpu",
    ]);
  });

  it("runs one download at a time and queues the rest", () => {
    const { manager, backend } = createManager();

    manager.start("embedding");
    manager.start("cuda");

    expect(backend.start).toHaveBeenCalledTimes(1);
    const snapshot = manager.snapshot();
    expect(item(snapshot, "embedding").state).toBe("downloading");
    expect(item(snapshot, "cuda").state).toBe("queued");
    expect(snapshot.queuedCount).toBe(1);
  });

  it("starts the queued download once the running one finishes", async () => {
    const { manager, backend, releases } = createManager();
    manager.start("embedding");
    manager.start("cuda");

    releases.get("embedding")!.resolve();
    await vi.waitFor(() => expect(backend.start).toHaveBeenCalledTimes(2));

    expect(manager.snapshot().items.map((entry) => entry.state)).toContain(
      "downloading",
    );
  });

  it("pushes a snapshot on every progress event", () => {
    const { manager, releases, snapshots } = createManager();
    manager.start("embedding");
    const before = snapshots.length;

    releases.get("embedding")!.progress({
      key: "embed-model",
      stage: "downloading",
      downloaded: 500,
      total: 1000,
      percent: 50,
    });

    expect(snapshots.length).toBeGreaterThan(before);
    const latest = item(snapshots[snapshots.length - 1]!, "embedding");
    expect(latest.percent).toBe(50);
    expect(latest.activeComponent).toBe("embed-model");
  });

  it("marks a cancelled download as cancelled rather than failed", async () => {
    const { manager, backend } = createManager();
    manager.start("embedding");

    manager.cancel("embedding");

    expect(backend.cancel).toHaveBeenCalledWith("embedding");
    await vi.waitFor(() =>
      expect(item(manager.snapshot(), "embedding").state).toBe("cancelled"),
    );
  });

  it("drops a queued download without touching the backend", () => {
    const { manager, backend } = createManager();
    manager.start("embedding");
    manager.start("cuda");

    manager.cancel("cuda");

    expect(backend.cancel).not.toHaveBeenCalledWith("cuda");
    expect(item(manager.snapshot(), "cuda").state).toBe("cancelled");
    expect(manager.snapshot().queuedCount).toBe(0);
  });

  it("keeps the failure reason for the user", async () => {
    const { manager, releases } = createManager();
    manager.start("cuda");

    releases.get("cuda")!.reject(new Error("Нет места на диске"));

    await vi.waitFor(() => {
      const entry = item(manager.snapshot(), "cuda");
      expect(entry.state).toBe("failed");
      expect(entry.error).toBe("Нет места на диске");
    });
  });

  it("refuses to delete files while the download is running", () => {
    const { manager, backend } = createManager();
    manager.start("embedding");

    expect(() => manager.remove("embedding")).toThrow(/Дождитесь/);
    expect(backend.remove).not.toHaveBeenCalled();
  });

  it("deletes an installed download and forgets its history", () => {
    const { manager, backend } = createManager(["ocr"]);

    manager.remove("ocr");

    expect(backend.remove).toHaveBeenCalledWith("ocr");
  });

  it("opens the folder of an installed download", () => {
    const { manager, backend } = createManager(["ocr"]);

    manager.reveal("ocr");

    expect(backend.reveal).toHaveBeenCalledWith("cache/ocr");
  });

  it("survives a backend that cannot report status", () => {
    const { manager, backend } = createManager();
    (backend.status as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Модуль не собран");
    });

    const snapshot = manager.snapshot();

    expect(snapshot.items).toHaveLength(4);
    expect(item(snapshot, "ocr").state).toBe("absent");
  });
});

describe("DownloadManagerService completion events", () => {
  function createReporting(installed: string[] = []) {
    const finished: Array<Record<string, unknown>> = [];
    const releases = new Map<
      string,
      { resolve: () => void; reject: (error: Error) => void }
    >();
    const backend: DownloadBackend = {
      status: vi.fn(() =>
        ["ocr", "embedding", "cuda"].map((id) =>
          group(id, installed.includes(id)),
        ),
      ),
      start: vi.fn(
        (id: DownloadId) =>
          new Promise<void>((resolve, reject) => {
            releases.set(id, { resolve, reject });
          }),
      ),
      cancel: vi.fn((id: DownloadId) =>
        releases.get(id)?.reject(new Error(CANCELLED_MESSAGE)),
      ),
      remove: vi.fn(() => []),
      reveal: vi.fn(),
    };
    const manager = new DownloadManagerService(
      backend,
      () => undefined,
      (event) => finished.push({ ...event }),
    );
    return { manager, releases, finished };
  }

  it("announces a finished download once", async () => {
    const { manager, releases, finished } = createReporting();
    manager.start("embedding");

    releases.get("embedding")!.resolve();

    await vi.waitFor(() => expect(finished).toHaveLength(1));
    expect(finished[0]).toMatchObject({
      id: "embedding",
      succeeded: true,
      cancelled: false,
    });
  });

  it("announces a failure with its reason", async () => {
    const { manager, releases, finished } = createReporting();
    manager.start("cuda");

    releases.get("cuda")!.reject(new Error("Нет места на диске"));

    await vi.waitFor(() => expect(finished).toHaveLength(1));
    expect(finished[0]).toMatchObject({
      succeeded: false,
      cancelled: false,
      error: "Нет места на диске",
    });
  });

  it("marks a cancelled download as cancelled, not failed", async () => {
    const { manager, finished } = createReporting();
    manager.start("embedding");

    manager.cancel("embedding");

    await vi.waitFor(() => expect(finished).toHaveLength(1));
    expect(finished[0]).toMatchObject({ succeeded: false, cancelled: true });
  });
});
