export type VectorStoreStatus = "ready" | "indexing" | "degraded" | "disabled";

export type VectorDocumentStatus =
  "queued" | "extracting" | "embedding" | "ready" | "failed";

export interface VectorStoreConfig {
  id: number;
  name: string;
  description: string;
  embeddingModelId: number | null;
  status: VectorStoreStatus;
  searchMode: "vector" | "hybrid";
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

export interface VectorStoreSnapshot {
  stores: VectorStoreConfig[];
  documents: VectorStoreDocument[];
}

export interface UpsertVectorStoreInput {
  id?: number;
  name: string;
  description: string;
  embeddingModelId: number | null;
  searchMode: "vector" | "hybrid";
  chunkSizeTokens: number;
  chunkOverlapTokens: number;
}

export interface UploadVectorDocumentInput {
  vectorStoreId: number;
  fileName: string;
  mimeType: string;
  data: ArrayBuffer;
}

export interface VectorSearchInput {
  vectorStoreIds: number[];
  query: string;
  limit?: number;
  scoreThreshold?: number;
}

export interface VectorSearchResultItem {
  documentId: number;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
  pageNumber: number | null;
}

export interface VectorStoreApi {
  getSnapshot(): Promise<VectorStoreSnapshot>;
  getDocuments(ids: number[]): Promise<VectorStoreDocument[]>;
  upsertStore(input: UpsertVectorStoreInput): Promise<VectorStoreSnapshot>;
  deleteStore(id: number): Promise<VectorStoreSnapshot>;
  uploadDocuments(
    input: UploadVectorDocumentInput[],
  ): Promise<VectorStoreSnapshot>;
  deleteDocument(id: number): Promise<VectorStoreSnapshot>;
  search(input: VectorSearchInput): Promise<VectorSearchResultItem[]>;
}

export const VECTOR_STORE_IPC_CHANNELS = {
  getSnapshot: "vector-stores:get-snapshot",
  getDocuments: "vector-stores:get-documents",
  upsertStore: "vector-stores:upsert",
  deleteStore: "vector-stores:delete",
  uploadDocuments: "vector-stores:upload-documents",
  deleteDocument: "vector-stores:delete-document",
  search: "vector-stores:search",
} as const;
