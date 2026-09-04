import type { VectorSearchMode } from "../dto";

export const MAX_VECTOR_DOCUMENT_BYTES = 64 * 1_048_576;

export type VectorStoreStatus = "ready" | "indexing" | "degraded" | "disabled";
export type VectorDocumentStatus =
  "queued" | "extracting" | "embedding" | "ready" | "failed";
export interface VectorStoreConfig {
  id: string;
  name: string;
  description: string;
  embeddingModelId: string | null;
  status: VectorStoreStatus;
  searchMode: VectorSearchMode;
  chunkSizeTokens: number;
  chunkOverlapTokens: number;
  vectorDimension: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface VectorStoreDocument {
  id: string;
  vectorStoreId: string;
  fileName: string;
  mimeType: string;
  size: number;
  status: VectorDocumentStatus;
  progress: number;
  chunkCount: number;
  createdAt: string;
  errorMessage: string | null;
}
export interface VectorStoreSnapshot {
  stores: VectorStoreConfig[];
  documents: VectorStoreDocument[];
}
export interface VectorSearchResultItem {
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
  pageNumber: number | null;
}

export const PROCESSING_STATUSES = [
  "queued",
  "extracting",
  "embedding",
] as const satisfies readonly VectorDocumentStatus[];

export const PROCESSING_STATUSES_SQL = PROCESSING_STATUSES.map(
  (status) => `'${status}'`,
).join(",");

export function isProcessing(status: string): boolean {
  return (PROCESSING_STATUSES as readonly string[]).includes(status);
}

export interface DocumentStage {
  status: Extract<VectorDocumentStatus, "queued" | "extracting" | "embedding">;
  from: number;
  to: number;
  label: string;
}

export const DOCUMENT_STAGES = {
  queued: { status: "queued", from: 0, to: 0, label: "В очереди" },
  reading: { status: "extracting", from: 5, to: 35, label: "Читаю документ" },
  splitting: {
    status: "extracting",
    from: 35,
    to: 40,
    label: "Делю на фрагменты",
  },
  embedding: {
    status: "embedding",
    from: 40,
    to: 90,
    label: "Строю векторы",
  },
  writing: { status: "embedding", from: 90, to: 100, label: "Сохраняю в базу" },
} as const satisfies Record<string, DocumentStage>;

export type DocumentStageName = keyof typeof DOCUMENT_STAGES;

export function stageProgress(
  stage: DocumentStageName,
  fraction = 1,
): { status: VectorDocumentStatus; progress: number } {
  const { status, from, to } = DOCUMENT_STAGES[stage];
  const clamped = Math.min(1, Math.max(0, fraction));
  return { status, progress: Math.round(from + (to - from) * clamped) };
}
