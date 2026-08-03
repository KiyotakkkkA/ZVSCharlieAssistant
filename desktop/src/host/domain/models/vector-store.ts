export type VectorStoreStatus = "ready" | "indexing" | "degraded" | "disabled";
export type VectorDocumentStatus = "queued" | "extracting" | "embedding" | "ready" | "failed";
export type VectorSearchMode = "vector" | "hybrid";

export interface VectorStoreConfig {
  id: number;
  name: string;
  description: string;
  embeddingModelId: number | null;
  status: VectorStoreStatus;
  searchMode: VectorSearchMode;
  chunkSizeTokens: number;
  chunkOverlapTokens: number;
  vectorDimension: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface VectorStoreDocument {
  id: number;
  vectorStoreId: number;
  fileName: string;
  mimeType: string;
  size: number;
  status: VectorDocumentStatus;
  progress: number;
  chunkCount: number;
  createdAt: string;
  errorMessage: string | null;
}

export interface VectorStoreSnapshot { stores: VectorStoreConfig[]; documents: VectorStoreDocument[] }
export interface UpsertVectorStoreInput { id?: number; name: string; description: string; embeddingModelId: number | null; searchMode: VectorSearchMode; chunkSizeTokens: number; chunkOverlapTokens: number }
export interface UploadVectorDocumentInput { vectorStoreId: number; fileName: string; mimeType: string; data: ArrayBuffer }
export interface VectorSearchInput { vectorStoreIds: number[]; query: string; limit?: number; scoreThreshold?: number }
export interface VectorSearchResultItem { documentId: number; fileName: string; chunkIndex: number; content: string; score: number; pageNumber: number | null }
