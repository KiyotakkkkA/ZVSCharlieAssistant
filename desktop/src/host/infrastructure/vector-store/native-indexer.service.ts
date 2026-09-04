import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ApplicationSettingsRepository } from "../electron/application-settings.repository";
import type { OcrProviderPreference } from "../../../ipc/contracts";
import type { DownloadGroupStatus } from "../downloads/download-manager.service";

export interface DeviceProbe {
  cudaAvailable: boolean;
  deviceName: string | null;
  vramMb: number | null;
  driverVersion: string | null;
  computeCapability: string | null;
  cudaKernelsAvailable: boolean | null;
  unavailableReason: string | null;
}

export interface IndexingAsset {
  key: string;
  present: boolean;
  sizeBytes: number | null;
  sourceUrl: string;
  path: string;
}

export interface IndexingAssetProgress {
  key: string;
  stage: "downloading" | "unpacking" | "ready";
  downloaded: number;
  total: number | null;
  percent: number | null;
}

export interface IndexingCapabilities extends DeviceProbe {
  preference: OcrProviderPreference;
  assets: IndexingAsset[];
  assetsReady: boolean;
  addonAvailable: boolean;
  ocrAccelerated: boolean;
  ocrProvider: OcrProvider;
  accelerationError: string | null;
}

interface AssetPaths {
  pdfium: string;
  ocrDetection: string;
  ocrRecognition: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  route: "text-layer" | "ocr" | "empty";
  recognisedLines: number;
}

export interface ExtractedDocument {
  pages: ExtractedPage[];
  textLayerPages: number;
  ocrPages: number;
  emptyPages: number;
  characters: number;
  accelerated: boolean;
}

export interface GpuSample {
  available: boolean;
  utilizationPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  temperatureCelsius: number | null;
  memoryBusPercent: number | null;
}

export interface NativeVectorChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  vector: number[];
  fileName: string;
  pageNumber: number;
  headingPath: string;
}

export interface NativeVectorSearchResult {
  documentId: string;
  fileName: string;
  chunkIndex: number;
  text: string;
  pageNumber: number;
  headingPath: string;
  score: number;
}

export type OcrProvider = "cuda" | "directml" | "cpu" | "none";

export interface OcrDiagnostics {
  loaded: boolean;
  accelerated: boolean;
  provider: OcrProvider;
  accelerationError: string | null;
}

interface NativeIndexerAddon {
  probeDevices(): DeviceProbe;
  sampleGpu(): GpuSample;
  ocrDiagnostics(cacheDir: string, provider: string): OcrDiagnostics;
  downloadStatus(cacheDir: string): DownloadGroupStatus[];
  startDownload(
    cacheDir: string,
    id: string,
    onProgress?: (progress: IndexingAssetProgress) => void,
  ): Promise<void>;
  cancelDownload(id: string): void;
  deleteDownload(cacheDir: string, id: string): DownloadGroupStatus[];
  embeddingDimension(): number | null;
  embedTexts(
    cacheDir: string,
    provider: string,
    texts: string[],
  ): Promise<number[][]>;
  initializeVectorIndex(directory: string): boolean;
  completeVectorIndexInitialization(directory: string): void;
  appendVectorChunks(
    directory: string,
    storeId: string,
    rows: NativeVectorChunk[],
  ): Promise<void>;
  finalizeVectorIndex(
    directory: string,
    storeId: string,
    hybrid: boolean,
  ): Promise<void>;
  removeVectorDocument(
    directory: string,
    storeId: string,
    documentId: string,
  ): Promise<void>;
  dropVectorStore(directory: string, storeId: string): Promise<void>;
  searchVectorIndex(
    directory: string,
    storeId: string,
    query: string,
    vector: number[],
    hybrid: boolean,
    limit: number,
  ): Promise<NativeVectorSearchResult[]>;
  stopIndexing(): void;
  resumeIndexing(): void;
  extractDocument(request: {
    cacheDir: string;
    filePath: string;
    renderWidth?: number;
    recogniseScans?: boolean;
    provider?: string;
    cancelOnIndexingStop?: boolean;
  }): Promise<ExtractedDocument>;
}

const PAGE_SEPARATOR = `

`;

const UNAVAILABLE: DeviceProbe = {
  cudaAvailable: false,
  deviceName: null,
  vramMb: null,
  driverVersion: null,
  computeCapability: null,
  cudaKernelsAvailable: null,
  unavailableReason:
    "Часть программы, которая читает документы, не установлена",
};

export class NativeIndexerService {
  private addon?: NativeIndexerAddon;
  private probe?: DeviceProbe;

  constructor(
    private readonly nativeRoot: string,
    private readonly cacheDir: string,
    private readonly vectorIndexDir: string,
    private readonly settings: ApplicationSettingsRepository,
    private readonly onAssetProgress?: (
      progress: IndexingAssetProgress,
    ) => void,
  ) {}

  initializeVectorIndex(): boolean {
    return this.requireAddon().initializeVectorIndex(this.vectorIndexDir);
  }

  completeVectorIndexInitialization(): void {
    this.requireAddon().completeVectorIndexInitialization(this.vectorIndexDir);
  }

  appendVectorChunks(storeId: string, rows: NativeVectorChunk[]) {
    return this.requireAddon().appendVectorChunks(
      this.vectorIndexDir,
      storeId,
      rows,
    );
  }

  finalizeVectorIndex(storeId: string, mode: "vector" | "hybrid") {
    return this.requireAddon().finalizeVectorIndex(
      this.vectorIndexDir,
      storeId,
      mode === "hybrid",
    );
  }

  removeVectorDocument(storeId: string, documentId: string) {
    return this.requireAddon().removeVectorDocument(
      this.vectorIndexDir,
      storeId,
      documentId,
    );
  }

  dropVectorStore(storeId: string) {
    return this.requireAddon().dropVectorStore(this.vectorIndexDir, storeId);
  }

  searchVectorIndex(
    storeId: string,
    query: string,
    vector: number[],
    mode: "vector" | "hybrid",
    limit: number,
  ) {
    return this.requireAddon().searchVectorIndex(
      this.vectorIndexDir,
      storeId,
      query,
      vector,
      mode === "hybrid",
      limit,
    );
  }

  stopIndexing(): void {
    this.requireAddon().stopIndexing();
  }

  resumeIndexing(): void {
    this.requireAddon().resumeIndexing();
  }

  devices(): DeviceProbe {
    if (this.probe) return this.probe;
    const addon = this.load();
    this.probe = addon ? addon.probeDevices() : UNAVAILABLE;
    return this.probe;
  }

  assets(): IndexingAsset[] {
    return this.downloadStatus()
      .filter((group) => group.id === "ocr")
      .flatMap((group) => group.components);
  }

  capabilities(): IndexingCapabilities {
    const probe = this.devices();
    const addonAvailable = this.load() !== undefined;
    const preference = this.settings.get().indexing.provider;
    const assets = this.assets();
    const assetsReady =
      assets.length > 0 && assets.every((asset) => asset.present);
    const diagnostics = assetsReady ? this.ocrDiagnostics(preference) : null;
    return {
      ...probe,
      preference,
      assets,
      assetsReady,
      addonAvailable,
      ocrAccelerated: diagnostics?.accelerated ?? false,
      ocrProvider: diagnostics?.provider ?? "none",
      accelerationError: diagnostics?.accelerationError ?? null,
    };
  }

  private ocrDiagnostics(
    preference: OcrProviderPreference,
  ): OcrDiagnostics | null {
    const addon = this.load();
    if (!addon) return null;
    try {
      return addon.ocrDiagnostics(this.cacheDir, preference);
    } catch (error) {
      return {
        loaded: false,
        accelerated: false,
        provider: "none",
        accelerationError:
          error instanceof Error ? error.message : String(error),
      };
    }
  }

  setProvider(preference: OcrProviderPreference): IndexingCapabilities {
    this.settings.update({ indexing: { provider: preference } });
    return this.capabilities();
  }

  downloadStatus(): DownloadGroupStatus[] {
    const addon = this.load();
    if (!addon) return [];
    return addon.downloadStatus(this.cacheDir);
  }

  startDownload(
    id: string,
    onProgress: (progress: IndexingAssetProgress) => void,
  ): Promise<void> {
    return this.requireAddon().startDownload(this.cacheDir, id, onProgress);
  }

  cancelDownload(id: string): void {
    this.load()?.cancelDownload(id);
  }

  deleteDownload(id: string): DownloadGroupStatus[] {
    return this.requireAddon().deleteDownload(this.cacheDir, id);
  }

  embeddingDimension(): number | null {
    try {
      return this.load()?.embeddingDimension() ?? null;
    } catch {
      return null;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const addon = this.requireAddon();
    const embedding = this.downloadStatus().find(
      (group) => group.id === "embedding",
    );
    if (!embedding?.installed)
      throw new Error(
        "Модель «Локальная модель (bge-m3)» не загружена. Откройте страницу «Загрузки» и нажмите «Загрузить».",
      );
    return addon.embedTexts(
      this.cacheDir,
      this.settings.get().indexing.provider,
      texts,
    );
  }

  private requireAddon(): NativeIndexerAddon {
    const addon = this.load();
    if (!addon)
      throw new Error(
        "Часть программы, которая читает документы, не установлена. Переустановите приложение.",
      );
    return addon;
  }

  sampleGpu(): GpuSample | null {
    const addon = this.load();
    if (!addon) return null;
    try {
      return addon.sampleGpu();
    } catch {
      return null;
    }
  }

  supportsNativeExtraction(): boolean {
    return this.load() !== undefined;
  }

  async extractDocument(
    filePath: string,
    cancelOnIndexingStop = false,
  ): Promise<ExtractedDocument> {
    const addon = this.load();
    if (!addon)
      throw new Error(
        "Часть программы, которая читает документы, не установлена. Переустановите приложение.",
      );
    if (!this.assets().every((asset) => asset.present))
      throw new Error(
        "Модели распознавания не загружены. Откройте настройки базы знаний и нажмите «Загрузить модели».",
      );
    return addon.extractDocument({
      cacheDir: this.cacheDir,
      filePath,
      recogniseScans: true,
      provider: this.settings.get().indexing.provider,
      cancelOnIndexingStop,
    });
  }

  async extractBuffer(fileName: string, data: ArrayBuffer): Promise<string> {
    const folder = await mkdtemp(join(tmpdir(), "zvs-extract-"));
    const path = join(folder, basename(fileName));
    try {
      await writeFile(path, Buffer.from(data));
      const document = await this.extractDocument(path);
      return document.pages
        .map((page) => page.text)
        .filter((text) => text.trim().length > 0)
        .join(PAGE_SEPARATOR);
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private load(): NativeIndexerAddon | undefined {
    if (this.addon) return this.addon;
    const file = join(this.nativeRoot, "zvs_indexer.node");
    try {
      this.addon = createRequire(import.meta.url)(file) as NativeIndexerAddon;
      return this.addon;
    } catch (error) {
      console.error(
        "Не удалось загрузить нативный модуль индексации",
        file,
        error,
      );
      return undefined;
    }
  }
}
