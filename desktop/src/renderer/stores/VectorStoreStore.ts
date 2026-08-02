import { makeAutoObservable, runInAction } from "mobx";

export type VectorStoreStatus = "ready" | "indexing" | "degraded" | "disabled";
export type VectorDocumentStatus =
  "queued" | "extracting" | "embedding" | "ready" | "failed";

export interface VectorDocument {
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

export interface VectorStoreModel {
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

const now = new Date().toISOString();

export class VectorStoreStore {
  stores: VectorStoreModel[] = [];
  documents: VectorDocument[] = [];
  initialized = false;
  loading = false;
  selectedStoreId: number | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap(force = false) {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    await Promise.resolve();
    runInAction(() => {
      if (!this.initialized) {
        this.stores = [
          {
            id: 1,
            name: "База знаний проекта",
            description: "Документация, требования и рабочие материалы.",
            embeddingModelId: null,
            status: "ready",
            searchMode: "hybrid",
            chunkSizeTokens: 700,
            chunkOverlapTokens: 100,
            vectorDimension: 768,
            createdAt: now,
            updatedAt: now,
          },
        ];
        this.documents = [
          {
            id: 1,
            vectorStoreId: 1,
            fileName: "Требования к проекту.pdf",
            mimeType: "application/pdf",
            size: 2_840_000,
            status: "ready",
            progress: 100,
            chunkCount: 84,
            createdAt: now,
            errorMessage: null,
          },
          {
            id: 2,
            vectorStoreId: 1,
            fileName: "Архитектура.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: 486_000,
            status: "ready",
            progress: 100,
            chunkCount: 31,
            createdAt: now,
            errorMessage: null,
          },
        ];
      }
      this.selectedStoreId ??= this.stores[0]?.id ?? null;
      this.initialized = true;
      this.loading = false;
    });
  }

  get selectedStore() {
    return this.stores.find((item) => item.id === this.selectedStoreId);
  }

  documentsFor(storeId: number) {
    return this.documents.filter((item) => item.vectorStoreId === storeId);
  }

  createStore() {
    const id = Math.max(0, ...this.stores.map((item) => item.id)) + 1;
    const item: VectorStoreModel = {
      id,
      name: "Новое векторное хранилище",
      description: "",
      embeddingModelId: null,
      status: "disabled",
      searchMode: "vector",
      chunkSizeTokens: 700,
      chunkOverlapTokens: 100,
      vectorDimension: null,
      createdAt: now,
      updatedAt: now,
    };
    this.stores.push(item);
    this.selectedStoreId = id;
  }

  updateStore(id: number, patch: Partial<VectorStoreModel>) {
    this.stores = this.stores.map((item) =>
      item.id === id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item,
    );
  }

  deleteStore(id: number) {
    this.stores = this.stores.filter((item) => item.id !== id);
    this.documents = this.documents.filter((item) => item.vectorStoreId !== id);
    if (this.selectedStoreId === id)
      this.selectedStoreId = this.stores[0]?.id ?? null;
  }

  addFiles(storeId: number, files: File[]) {
    let id = Math.max(0, ...this.documents.map((item) => item.id));
    this.documents.push(
      ...files.map((file) => ({
        id: ++id,
        vectorStoreId: storeId,
        fileName: file.name,
        mimeType: file.type || "text/plain",
        size: file.size,
        status: "queued" as const,
        progress: 0,
        chunkCount: 0,
        createdAt: new Date().toISOString(),
        errorMessage: null,
      })),
    );
  }

  deleteDocument(id: number) {
    this.documents = this.documents.filter((item) => item.id !== id);
  }
}

export const vectorStoreStore = new VectorStoreStore();
