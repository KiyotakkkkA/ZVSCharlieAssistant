import { makeAutoObservable, runInAction } from "mobx";
import type {
  UpsertVectorStoreInput,
  VectorSearchInput,
  VectorStoreConfig,
  VectorStoreDocument,
  VectorStoreSnapshot,
} from "../../ipc/contracts";

export type VectorStoreModel = VectorStoreConfig;
export type VectorDocument = VectorStoreDocument;

class VectorStoreStore {
  stores: VectorStoreConfig[] = [];
  documents: VectorStoreDocument[] = [];
  initialized = false;
  loading = false;
  selectedStoreId: number | null = null;
  private readonly updateVersions = new Map<number, number>();

  constructor() {
    makeAutoObservable<this, "updateVersions">(
      this,
      { updateVersions: false },
      { autoBind: true },
    );
  }

  private apply(snapshot: VectorStoreSnapshot) {
    this.stores = snapshot.stores;
    this.documents = snapshot.documents;
    this.selectedStoreId = this.stores.some(
      (item) => item.id === this.selectedStoreId,
    )
      ? this.selectedStoreId
      : (this.stores[0]?.id ?? null);
    this.initialized = true;
  }

  async bootstrap(force = false) {
    if (this.loading || (this.initialized && !force)) return;
    this.loading = true;
    try {
      const snapshot = await window.desktop.vectorStores.getSnapshot();
      runInAction(() => this.apply(snapshot));
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  get selectedStore() {
    return this.stores.find((item) => item.id === this.selectedStoreId);
  }

  documentsFor(storeId: number) {
    return this.documents.filter((item) => item.vectorStoreId === storeId);
  }

  async createStore() {
    const snapshot = await window.desktop.vectorStores.upsertStore({
      name: "Новое векторное хранилище",
      description: "",
      embeddingModelId: null,
      searchMode: "vector",
      chunkSizeTokens: 700,
      chunkOverlapTokens: 100,
    });
    runInAction(() => {
      const previous = new Set(this.stores.map((item) => item.id));
      this.apply(snapshot);
      this.selectedStoreId =
        snapshot.stores.find((item) => !previous.has(item.id))?.id ??
        this.selectedStoreId;
    });
  }

  async updateStore(id: number, patch: Partial<VectorStoreConfig>) {
    const current = this.stores.find((item) => item.id === id);
    if (!current) return;
    const input: UpsertVectorStoreInput = {
      id,
      name: patch.name ?? current.name,
      description: patch.description ?? current.description,
      embeddingModelId:
        patch.embeddingModelId === undefined
          ? current.embeddingModelId
          : patch.embeddingModelId,
      searchMode: patch.searchMode ?? current.searchMode,
      chunkSizeTokens: patch.chunkSizeTokens ?? current.chunkSizeTokens,
      chunkOverlapTokens:
        patch.chunkOverlapTokens ?? current.chunkOverlapTokens,
    };
    const version = (this.updateVersions.get(id) ?? 0) + 1;
    this.updateVersions.set(id, version);
    this.stores = this.stores.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    try {
      const snapshot = await window.desktop.vectorStores.upsertStore(input);
      if (this.updateVersions.get(id) === version)
        runInAction(() => this.apply(snapshot));
    } catch (error) {
      if (this.updateVersions.get(id) === version) await this.bootstrap(true);
      throw error;
    }
  }

  async deleteStore(id: number) {
    const snapshot = await window.desktop.vectorStores.deleteStore(id);
    runInAction(() => this.apply(snapshot));
  }

  async addFiles(storeId: number, files: File[]) {
    const input = await Promise.all(
      files.map(async (file) => ({
        vectorStoreId: storeId,
        fileName: file.name,
        mimeType: file.type || "text/plain",
        data: await file.arrayBuffer(),
      })),
    );
    const previousStatuses = new Map(
      this.documents.map((item) => [item.id, item.status]),
    );
    const snapshot = await window.desktop.vectorStores.uploadDocuments(input);
    const uploadedIds = snapshot.documents
      .filter((item) => {
        const previousStatus = previousStatuses.get(item.id);
        return (
          previousStatus === undefined ||
          (previousStatus === "failed" && item.status !== "failed")
        );
      })
      .map((item) => item.id);
    runInAction(() => this.apply(snapshot));
    if (!uploadedIds.length)
      throw new Error("Документы не были поставлены на обработку");
    await this.pollUntilSettled(uploadedIds);
  }

  async deleteDocument(id: number) {
    const snapshot = await window.desktop.vectorStores.deleteDocument(id);
    runInAction(() => this.apply(snapshot));
  }

  search(input: VectorSearchInput) {
    return window.desktop.vectorStores.search(input);
  }

  private async pollUntilSettled(documentIds: number[]) {
    for (let attempt = 0; attempt < 300; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const documents =
        await window.desktop.vectorStores.getDocuments(documentIds);
      runInAction(() => {
        const updates = new Map(documents.map((item) => [item.id, item]));
        this.documents = this.documents.map(
          (item) => updates.get(item.id) ?? item,
        );
      });
      if (
        documents.length === documentIds.length &&
        documents.every(
          (item) => item.status === "ready" || item.status === "failed",
        )
      ) {
        const snapshot = await window.desktop.vectorStores.getSnapshot();
        runInAction(() => this.apply(snapshot));
        const failed = documents.find((item) => item.status === "failed");
        if (failed)
          throw new Error(
            failed.errorMessage || `Не удалось обработать «${failed.fileName}»`,
          );
        return;
      }
      if (!documents.length) throw new Error("Документы обработки не найдены");
    }
    throw new Error("Превышено время ожидания обработки документов");
  }
}

export const vectorStoreStore = new VectorStoreStore();
