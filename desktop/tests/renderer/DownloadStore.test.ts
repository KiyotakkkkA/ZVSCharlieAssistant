import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadStore } from "../../src/renderer/stores/DownloadStore";
import {
  DOWNLOAD_CATALOG,
  type DownloadItem,
  type DownloadsSnapshot,
} from "../../src/shared/models/downloads";

function makeItem(
  id: DownloadItem["id"],
  patch: Partial<DownloadItem> = {},
): DownloadItem {
  const entry = DOWNLOAD_CATALOG.find((item) => item.id === id)!;
  return {
    ...entry,
    state: "absent",
    installed: false,
    downloadBytes: 1_000_000,
    sizeBytes: 0,
    directory: `cache/${id}`,
    components: [],
    receivedBytes: 0,
    totalBytes: null,
    percent: null,
    activeComponent: null,
    startedAt: null,
    finishedAt: null,
    error: null,
    ...patch,
  };
}

function snapshot(items: DownloadItem[]): DownloadsSnapshot {
  return {
    items,
    activeCount: items.filter((item) => item.state === "downloading").length,
    queuedCount: items.filter((item) => item.state === "queued").length,
  };
}

function stubDesktop(initial: DownloadsSnapshot) {
  const listeners: Array<(next: DownloadsSnapshot) => void> = [];
  const api = {
    getSnapshot: vi.fn().mockResolvedValue(initial),
    start: vi.fn().mockResolvedValue(initial),
    cancel: vi.fn().mockResolvedValue(initial),
    remove: vi.fn().mockResolvedValue(initial),
    reveal: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((listener: (next: DownloadsSnapshot) => void) => {
      listeners.push(listener);
      return () => undefined;
    }),
  };
  vi.stubGlobal("window", { desktop: { downloads: api } });
  return { api, listeners };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DownloadStore", () => {
  it("exposes the catalog before the host has answered", () => {
    stubDesktop(snapshot([]));
    const store = new DownloadStore();

    expect(store.items).toHaveLength(DOWNLOAD_CATALOG.length);
    expect(store.items.every((item) => !item.installed)).toBe(true);
  });

  it("groups downloads by category for the page sections", async () => {
    stubDesktop(
      snapshot([makeItem("ocr"), makeItem("embedding"), makeItem("cuda")]),
    );
    const store = new DownloadStore();
    await store.bootstrap();

    expect(store.byCategory("models").map((item) => item.id)).toEqual([
      "ocr",
      "embedding",
    ]);
    expect(store.byCategory("gpu").map((item) => item.id)).toEqual(["cuda"]);
  });

  it("updates itself when the host pushes a change", async () => {
    const { listeners } = stubDesktop(snapshot([makeItem("embedding")]));
    const store = new DownloadStore();
    await store.bootstrap();

    listeners[0]!(
      snapshot([makeItem("embedding", { state: "downloading", percent: 42 })]),
    );

    expect(store.find("embedding").percent).toBe(42);
    expect(store.busy.map((item) => item.id)).toEqual(["embedding"]);
  });

  it("totals what is still missing for the header badge", async () => {
    stubDesktop(
      snapshot([
        makeItem("ocr", { installed: true, state: "installed" }),
        makeItem("embedding", { downloadBytes: 1_151_000_000 }),
        makeItem("cuda", { downloadBytes: 813_000_000 }),
      ]),
    );
    const store = new DownloadStore();
    await store.bootstrap();

    expect(store.pending.map((item) => item.id)).toEqual(["embedding", "cuda"]);
    expect(store.pendingBytes).toBe(1_964_000_000);
  });

  it("averages progress across everything that is running", async () => {
    stubDesktop(
      snapshot([
        makeItem("embedding", { state: "downloading", percent: 20 }),
        makeItem("cuda", { state: "downloading", percent: 60 }),
      ]),
    );
    const store = new DownloadStore();
    await store.bootstrap();

    expect(store.overallPercent).toBe(40);
  });

  it("reports no overall progress when nothing is running", async () => {
    stubDesktop(snapshot([makeItem("ocr", { installed: true })]));
    const store = new DownloadStore();
    await store.bootstrap();

    expect(store.overallPercent).toBeNull();
  });

  it("forwards every action to the host", async () => {
    const { api } = stubDesktop(snapshot([makeItem("cuda")]));
    const store = new DownloadStore();
    await store.bootstrap();

    await store.start("cuda");
    await store.cancel("cuda");
    await store.remove("cuda");
    store.reveal("cuda");

    expect(api.start).toHaveBeenCalledWith("cuda");
    expect(api.cancel).toHaveBeenCalledWith("cuda");
    expect(api.remove).toHaveBeenCalledWith("cuda");
    expect(api.reveal).toHaveBeenCalledWith("cuda");
  });

  it("subscribes only once across repeated bootstraps", async () => {
    const { api } = stubDesktop(snapshot([makeItem("ocr")]));
    const store = new DownloadStore();

    await store.bootstrap();
    await store.bootstrap(true);

    expect(api.subscribe).toHaveBeenCalledOnce();
  });

  it("surfaces a failed download for the user to retry", async () => {
    stubDesktop(
      snapshot([
        makeItem("cuda", { state: "failed", error: "Нет места на диске" }),
      ]),
    );
    const store = new DownloadStore();
    await store.bootstrap();

    expect(store.failed.map((item) => item.error)).toEqual([
      "Нет места на диске",
    ]);
  });
});

describe("explainCudaSupport", () => {
  it("warns when the card is newer than CUDA supports", async () => {
    const { explainCudaSupport } =
      await import("../../src/renderer/lib/plain-language");

    const message = explainCudaSupport({
      cudaAvailable: true,
      deviceName: "NVIDIA GeForce RTX 5060 Ti",
      computeCapability: "12.0",
      cudaKernelsAvailable: false,
    } as never);

    expect(message?.title).toContain("CUDA");
    expect(message?.text).toContain("DirectML");
    expect(message?.details).toContain("12.0");
  });

  it("stays quiet for a card CUDA can drive", async () => {
    const { explainCudaSupport } =
      await import("../../src/renderer/lib/plain-language");

    expect(
      explainCudaSupport({
        cudaAvailable: true,
        deviceName: "NVIDIA GeForce RTX 4070",
        computeCapability: "8.9",
        cudaKernelsAvailable: true,
      } as never),
    ).toBeNull();
  });

  it("stays quiet when there is no NVIDIA card at all", async () => {
    const { explainCudaSupport } =
      await import("../../src/renderer/lib/plain-language");

    expect(explainCudaSupport({ cudaAvailable: false } as never)).toBeNull();
  });

  it("does not require CUDA libraries when the bundled kernels cannot drive the GPU", async () => {
    const { isDownloadNeededOnThisComputer } =
      await import("../../src/renderer/lib/plain-language");
    const capabilities = {
      cudaAvailable: true,
      cudaKernelsAvailable: false,
    } as never;

    expect(isDownloadNeededOnThisComputer("cuda", capabilities)).toBe(false);
    expect(isDownloadNeededOnThisComputer("ocr", capabilities)).toBe(true);
    expect(isDownloadNeededOnThisComputer("embedding", capabilities)).toBe(
      true,
    );
  });

  it("translates the missing-kernel error into advice", async () => {
    const { explainAccelerationProblem } =
      await import("../../src/renderer/lib/plain-language");

    const message = explainAccelerationProblem(
      "Проверочный запуск не удался: Non-zero status code returned while running Mul node. Name:'Mul.0' Status Message: CUDA error cudaErrorNoKernelImageForDevice:no kernel image is available for execution on the device",
    );

    expect(message.text).toContain("новее");
    expect(message.text).toContain("DirectML");
  });
});
