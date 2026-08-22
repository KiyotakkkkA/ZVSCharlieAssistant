import type { VectorSearchMode } from "../dto";

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
