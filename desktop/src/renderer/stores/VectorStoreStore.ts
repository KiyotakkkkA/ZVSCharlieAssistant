import { makeAutoObservable, runInAction } from "mobx";
import type {
  OcrProviderPreference,
  IngestProgress,
  ResourceSample,
  IndexingCapabilities,
  VectorStoreConfig,
  VectorStoreDocument,
  VectorStoreSnapshot,
} from "../../ipc/contracts";
import {
  parseIpcDto,
  upsertVectorStoreDtoSchema,
  vectorSearchDtoSchema,
  type UpsertVectorStoreInput,
  type VectorSearchInput,
} from "../../shared/dto";

export type VectorStoreModel = VectorStoreConfig;
export type VectorDocument = VectorStoreDocument;

const EMPTY_DOCUMENTS: VectorStoreDocument[] = [];

export class VectorStoreStore {
  stores: VectorStoreConfig[] = [];
  documents: VectorStoreDocument[] = [];
  initialized = false;
  loading = false;
  selectedStoreId: string | null = null;
  activeDirectoryBatches = new Map<string, string[]>();
  capabilities: IndexingCapabilities | null = null;
  resourceSample: ResourceSample | null = null;
  ingestProgress: IngestProgress | null = null;
  cancelling = false;
  private readonly updateVersions = new Map<string, number>();
  private resourceWatcher?: () => void;
  private ingestProgressTimer?: ReturnType<typeof setInterval>;
  private processingMonitor?: Promise<void>;

  constructor() {
    makeAutoObservable<
      this,
      | "updateVersions"
      | "processingMonitor"
      | "resourceWatcher"
      | "ingestProgressTimer"
    >(
      this,
      {
        updateVersions: false,
        processingMonitor: false,
        resourceWatcher: false,
        ingestProgressTimer: false,
      },
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
      const [snapshot, capabilities] = await Promise.all([
        window.desktop.vectorStores.getSnapshot(),
        window.desktop.vectorStores.getIndexingCapabilities().catch(() => null),
      ]);
      runInAction(() => {
        this.apply(snapshot);
        this.capabilities = capabilities;
      });
      this.ensureProcessingMonitor();
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  get selectedStore() {
    return this.stores.find((item) => item.id === this.selectedStoreId);
  }

  get documentsByStore(): Map<string, VectorStoreDocument[]> {
    const groups = new Map<string, VectorStoreDocument[]>();
    for (const item of this.documents) {
      const group = groups.get(item.vectorStoreId);
      if (group) group.push(item);
      else groups.set(item.vectorStoreId, [item]);
    }
    return groups;
  }

  documentsFor(storeId: string) {
    return this.documentsByStore.get(storeId) ?? EMPTY_DOCUMENTS;
  }

  activeDirectoryDocuments(storeId: string) {
    const ids = new Set(this.activeDirectoryBatches.get(storeId) ?? []);
    return this.documents.filter((item) => ids.has(item.id));
  }

  processingDocuments(storeId: string) {
    return this.documentsFor(storeId).filter((item) =>
      isProcessingStatus(item.status),
    );
  }

  startMonitoring(storeId: string) {
    if (!this.resourceWatcher)
      this.resourceWatcher =
        window.desktop.vectorStores.subscribeResourceSample?.((sample) => {
          runInAction(() => {
            this.resourceSample = sample;
          });
        });
    void window.desktop.vectorStores.startResourceMonitor?.();
    if (this.ingestProgressTimer) return;
    const poll = () =>
      void window.desktop.vectorStores
        .getIngestProgress(storeId)
        .then((progress) =>
          runInAction(() => {
            this.ingestProgress = progress;
          }),
        )
        .catch(() => undefined);
    poll();
    this.ingestProgressTimer = setInterval(poll, 1000);
  }

  stopMonitoring() {
    void window.desktop.vectorStores.stopResourceMonitor?.();
    if (this.ingestProgressTimer) clearInterval(this.ingestProgressTimer);
    this.ingestProgressTimer = undefined;
    this.resourceWatcher?.();
    this.resourceWatcher = undefined;
    runInAction(() => {
      this.resourceSample = null;
      this.ingestProgress = null;
    });
  }

  async stopIndexing() {
    this.cancelling = true;
    try {
      const snapshot =
        await window.desktop.vectorStores.stopIndexing();
      runInAction(() => this.apply(snapshot));
    } finally {
      runInAction(() => {
        this.cancelling = false;
      });
    }
  }

  async resumeIndexing() {
    const snapshot = await window.desktop.vectorStores.resumeIndexing();
    runInAction(() => this.apply(snapshot));
    this.ensureProcessingMonitor();
  }

  async setOcrProvider(preference: OcrProviderPreference) {
    const capabilities =
      await window.desktop.vectorStores.setOcrProvider(preference);
    runInAction(() => {
      this.capabilities = capabilities;
    });
  }

  async createStore() {
    const snapshot = await window.desktop.vectorStores.upsertStore(
      parseIpcDto(upsertVectorStoreDtoSchema, {
        name: "Новое векторное хранилище",
        description: "",
        embeddingModelId: null,
        searchMode: "vector",
        chunkSizeTokens: 700,
        chunkOverlapTokens: 100,
      }),
    );
    runInAction(() => {
      const previous = new Set(this.stores.map((item) => item.id));
      this.apply(snapshot);
      this.selectedStoreId =
        snapshot.stores.find((item) => !previous.has(item.id))?.id ??
        this.selectedStoreId;
    });
  }

  async updateStore(id: string, patch: Partial<VectorStoreConfig>) {
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
      const snapshot = await window.desktop.vectorStores.upsertStore(
        parseIpcDto(upsertVectorStoreDtoSchema, input),
      );
      if (this.updateVersions.get(id) === version)
        runInAction(() => this.apply(snapshot));
    } catch (error) {
      if (this.updateVersions.get(id) === version) await this.bootstrap(true);
      throw error;
    }
  }

  async retryFailedDocuments(id: string) {
    const snapshot = await window.desktop.vectorStores.retryFailedDocuments(id);
    runInAction(() => this.apply(snapshot));
    this.ensureProcessingMonitor();
  }

  async deleteStore(id: string) {
    const snapshot = await window.desktop.vectorStores.deleteStore(id);
    runInAction(() => this.apply(snapshot));
  }

  async clearDocuments(id: string) {
    const snapshot = await window.desktop.vectorStores.clearDocuments(id);
    runInAction(() => this.apply(snapshot));
  }

  async addFiles(storeId: string, files: File[]) {
    const input = await Promise.all(
      files.map(async (file) => ({
        vectorStoreId: storeId,
        fileName: file.name,
        mimeType: file.type || "text/plain",
        data: await file.arrayBuffer(),
      })),
    );
    const previousStatuses = this.documentStatuses();
    const snapshot = await window.desktop.vectorStores.uploadDocuments(input);
    const uploadedIds = this.applyUploadedSnapshot(
      storeId,
      previousStatuses,
      snapshot,
    );
    await this.pollUntilSettled(uploadedIds);
    return uploadedIds.length;
  }

  async addDirectory(storeId: string, directoryPath: string) {
    const previousStatuses = this.documentStatuses();
    const snapshot = await window.desktop.vectorStores.uploadDirectory({
      vectorStoreId: storeId,
      directoryPath,
    });
    const uploadedIds = this.applyUploadedSnapshot(
      storeId,
      previousStatuses,
      snapshot,
    );
    runInAction(() => this.activeDirectoryBatches.set(storeId, uploadedIds));
    try {
      await this.pollUntilSettled(uploadedIds);
      return uploadedIds.length;
    } finally {
      runInAction(() => this.activeDirectoryBatches.delete(storeId));
    }
  }

  async deleteDocument(id: string) {
    const snapshot = await window.desktop.vectorStores.deleteDocument(id);
    runInAction(() => this.apply(snapshot));
  }

  search(input: VectorSearchInput) {
    return window.desktop.vectorStores.search(
      parseIpcDto(vectorSearchDtoSchema, input),
    );
  }

  private async pollUntilSettled(documentIds: string[]) {
    for (let attempt = 0; attempt < 300; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const documents = (
        await Promise.all(
          chunk(documentIds, 100).map((ids) =>
            window.desktop.vectorStores.getDocuments(ids),
          ),
        )
      ).flat();
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

  private documentStatuses() {
    return new Map(this.documents.map((item) => [item.id, item.status]));
  }

  private applyUploadedSnapshot(
    storeId: string,
    previousStatuses: Map<string, VectorStoreDocument["status"]>,
    snapshot: VectorStoreSnapshot,
  ) {
    const uploadedIds = snapshot.documents
      .filter((item) => {
        if (item.vectorStoreId !== storeId) return false;
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
    return uploadedIds;
  }

  private ensureProcessingMonitor() {
    if (this.processingMonitor || !this.documents.some(isProcessingDocument))
      return;
    const monitor = this.monitorProcessingDocuments();
    this.processingMonitor = monitor;
    void monitor.finally(() => {
      if (this.processingMonitor === monitor)
        this.processingMonitor = undefined;
      if (this.documents.some(isProcessingDocument))
        this.ensureProcessingMonitor();
    });
  }

  private async monitorProcessingDocuments() {
    while (this.documents.some(isProcessingDocument)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const ids = this.documents
        .filter(isProcessingDocument)
        .map((document) => document.id);
      if (!ids.length) return;
      try {
        const documents = (
          await Promise.all(
            chunk(ids, 100).map((part) =>
              window.desktop.vectorStores.getDocuments(part),
            ),
          )
        ).flat();
        runInAction(() => {
          for (const update of documents) {
            const index = this.documents.findIndex(
              (item) => item.id === update.id,
            );
            if (index >= 0) this.documents[index] = update;
          }
        });
        if (
          documents.length !== ids.length ||
          !documents.some(isProcessingDocument)
        ) {
          const snapshot = await window.desktop.vectorStores.getSnapshot();
          runInAction(() => this.apply(snapshot));
        }
      } catch {}
    }
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    result.push(items.slice(index, index + size));
  return result;
}

function isProcessingDocument(document: VectorStoreDocument) {
  return isProcessingStatus(document.status);
}

function isProcessingStatus(status: VectorStoreDocument["status"]) {
  return (
    status === "queued" || status === "extracting" || status === "embedding"
  );
}

export const vectorStoreStore = new VectorStoreStore();
