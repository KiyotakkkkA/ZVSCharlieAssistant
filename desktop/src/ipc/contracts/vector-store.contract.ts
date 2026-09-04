import type { OcrProviderPreference } from "./app.contract";
import type {
  VectorSearchResultItem,
  VectorStoreDocument,
  VectorStoreSnapshot,
} from "../../shared/models/vector-store";
import type {
  UpsertVectorStoreInput,
  UploadVectorDocumentInput,
  UploadVectorDirectoryInput,
  VectorSearchInput,
} from "../../shared/dto";

export type * from "../../shared/models/vector-store";

export interface VectorDirectoryPreview {
  path: string;
  name: string;
  supportedFiles: number;
  ignoredFiles: number;
  totalBytes: number;
  examples: string[];
}

export interface IndexingAsset {
  key: string;
  present: boolean;
  sizeBytes: number | null;
  sourceUrl: string;
  path: string;
}

export interface IndexingCapabilities {
  cudaAvailable: boolean;
  deviceName: string | null;
  vramMb: number | null;
  driverVersion: string | null;
  computeCapability: string | null;
  cudaKernelsAvailable: boolean | null;
  unavailableReason: string | null;
  preference: OcrProviderPreference;
  assets: IndexingAsset[];
  assetsReady: boolean;
  addonAvailable: boolean;
  ocrAccelerated: boolean;
  ocrProvider: "cuda" | "directml" | "cpu" | "none";
  accelerationError: string | null;
}

export interface GpuSample {
  available: boolean;
  utilizationPercent: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  temperatureCelsius: number | null;
  memoryBusPercent: number | null;
}

export interface ResourceSample {
  timestamp: number;
  cpuPercent: number;
  coreCount: number;
  ramUsedMb: number;
  ramTotalMb: number;
  processRssMb: number;
  gpu: GpuSample | null;
}

export interface IngestProgress {
  storeId: string;
  total: number;
  completed: number;
  failed: number;
  remaining: number;
  active: number;
  averageMs: number | null;
  etaMs: number | null;
  startedAt: number;
  cancelling: boolean;
  paused: boolean;
}

export interface VectorStoreApi {
  getSnapshot(): Promise<VectorStoreSnapshot>;
  getIndexingCapabilities(): Promise<IndexingCapabilities>;
  setOcrProvider(
    preference: OcrProviderPreference,
  ): Promise<IndexingCapabilities>;
  getDocuments(ids: string[]): Promise<VectorStoreDocument[]>;
  upsertStore(input: UpsertVectorStoreInput): Promise<VectorStoreSnapshot>;
  deleteStore(id: string): Promise<VectorStoreSnapshot>;
  clearDocuments(id: string): Promise<VectorStoreSnapshot>;
  retryFailedDocuments(id: string): Promise<VectorStoreSnapshot>;
  stopIndexing(): Promise<VectorStoreSnapshot>;
  resumeIndexing(): Promise<VectorStoreSnapshot>;
  getIngestProgress(id: string): Promise<IngestProgress | null>;
  startResourceMonitor(): Promise<void>;
  stopResourceMonitor(): Promise<void>;
  subscribeResourceSample(
    listener: (sample: ResourceSample) => void,
  ): () => void;
  uploadDocuments(
    input: UploadVectorDocumentInput[],
  ): Promise<VectorStoreSnapshot>;
  selectDirectory(
    mode: "documents" | "code",
  ): Promise<VectorDirectoryPreview | null>;
  uploadDirectory(
    input: UploadVectorDirectoryInput,
  ): Promise<VectorStoreSnapshot>;
  deleteDocument(id: string): Promise<VectorStoreSnapshot>;
  search(input: VectorSearchInput): Promise<VectorSearchResultItem[]>;
}

export const VECTOR_STORE_IPC_CHANNELS = {
  getSnapshot: "vector-stores:get-snapshot",
  getIndexingCapabilities: "vector-stores:get-indexing-capabilities",
  setOcrProvider: "vector-stores:set-ocr-provider",
  getDocuments: "vector-stores:get-documents",
  upsertStore: "vector-stores:upsert",
  deleteStore: "vector-stores:delete",
  clearDocuments: "vector-stores:clear-documents",
  retryFailedDocuments: "vector-stores:retry-failed-documents",
  stopIndexing: "vector-stores:stop-indexing",
  resumeIndexing: "vector-stores:resume-indexing",
  getIngestProgress: "vector-stores:get-ingest-progress",
  startResourceMonitor: "vector-stores:start-resource-monitor",
  stopResourceMonitor: "vector-stores:stop-resource-monitor",
  resourceSample: "vector-stores:resource-sample",
  uploadDocuments: "vector-stores:upload-documents",
  selectDirectory: "vector-stores:select-directory",
  uploadDirectory: "vector-stores:upload-directory",
  deleteDocument: "vector-stores:delete-document",
  search: "vector-stores:search",
} as const;
