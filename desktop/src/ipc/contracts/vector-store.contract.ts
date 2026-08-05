import type {
  VectorSearchResultItem,
  VectorStoreDocument,
  VectorStoreSnapshot,
} from "../../shared/models/vector-store";
import type {
  UpsertVectorStoreInput,
  UploadVectorDocumentInput,
  VectorSearchInput,
} from "../../shared/dto";

export type * from "../../shared/models/vector-store";

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
