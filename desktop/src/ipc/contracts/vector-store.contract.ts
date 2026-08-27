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

export interface VectorStoreApi {
  getSnapshot(): Promise<VectorStoreSnapshot>;
  getDocuments(ids: string[]): Promise<VectorStoreDocument[]>;
  upsertStore(input: UpsertVectorStoreInput): Promise<VectorStoreSnapshot>;
  deleteStore(id: string): Promise<VectorStoreSnapshot>;
  clearDocuments(id: string): Promise<VectorStoreSnapshot>;
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
  getDocuments: "vector-stores:get-documents",
  upsertStore: "vector-stores:upsert",
  deleteStore: "vector-stores:delete",
  clearDocuments: "vector-stores:clear-documents",
  uploadDocuments: "vector-stores:upload-documents",
  selectDirectory: "vector-stores:select-directory",
  uploadDirectory: "vector-stores:upload-directory",
  deleteDocument: "vector-stores:delete-document",
  search: "vector-stores:search",
} as const;
