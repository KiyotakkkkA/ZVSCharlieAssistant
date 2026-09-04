import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  NativeIndexerService,
  NativeVectorChunk,
} from "./native-indexer.service";
import type {
  UploadVectorDocumentInput,
  UpsertVectorStoreInput,
  VectorSearchInput,
} from "../../../shared/dto";
import {
  MAX_VECTOR_DOCUMENT_BYTES,
  isProcessing,
  stageProgress,
  type DocumentStageName,
  type VectorSearchResultItem,
} from "../../../shared/models/vector-store";
import type {
  StoredDocumentRow,
  VectorStoreRepository,
} from "../database/vector-store.repository";
import { EmbeddingService } from "./embedding.service";
import { isBuiltinEmbeddingModelId } from "../../../shared/entity-ids";

const INGEST_CONCURRENCY = 2;
const DURATION_WINDOW = 24;
const EMBED_BATCH = 16;

interface QueuedIngest {
  storeId: string;
  documentId: string;
  run: (generation: number) => Promise<IngestOutcome>;
}

type IngestOutcome = "succeeded" | "failed" | "paused";

interface IngestBatch {
  total: number;
  completed: number;
  failed: number;
  startedAt: number;
  durations: number[];
  cancelling: boolean;
}

export interface IngestBatchResult {
  storeId: string;
  storeName: string;
  total: number;
  succeeded: number;
  failed: number;
  elapsedMs: number;
  cancelled: boolean;
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

export class VectorStoreService {
  private activeIngests = 0;
  private readonly ingestQueue: QueuedIngest[] = [];
  private readonly activeByStore = new Map<string, number>();
  private readonly batches = new Map<string, IngestBatch>();
  private paused = false;
  private stopGeneration = 0;

  constructor(
    private readonly data: VectorStoreRepository,
    private readonly embeddings: EmbeddingService,
    private readonly filesDir: string,
    private readonly indexer: NativeIndexerService,
    private readonly onBatchCompleted?: (event: IngestBatchResult) => void,
  ) {}

  snapshot() {
    return this.data.snapshot();
  }

  documents(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length > 100)
      throw new Error("Некорректный список документов");
    return this.data.documents(uniqueIds);
  }

  async upsert(input: UpsertVectorStoreInput) {
    validateStore(input);
    if (
      input.embeddingModelId !== null &&
      !isBuiltinEmbeddingModelId(input.embeddingModelId) &&
      !this.data.embeddingModel(input.embeddingModelId)
    )
      throw new Error("Выбрана недоступная embedding-модель");
    const current =
      input.id === undefined ? undefined : this.data.store(input.id);
    const embeddingChanged =
      current !== undefined &&
      current.embeddingModelId !== input.embeddingModelId;
    if (embeddingChanged && this.data.hasDocuments(current.id))
      throw new Error(
        "Перед сменой embedding-модели удалите документы из хранилища",
      );
    if (embeddingChanged) await this.indexer.dropVectorStore(current.id);
    const storeId = this.data.upsert({
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
    });
    return this.snapshot();
  }

  async deleteStore(id: string) {
    if (this.data.hasProcessingDocuments(id))
      throw new Error("Дождитесь завершения обработки документов");
    await this.indexer.dropVectorStore(id);
    await rm(join(this.filesDir, String(id)), { recursive: true, force: true });
    this.data.deleteStore(id);
    return this.snapshot();
  }

  async clearDocuments(id: string) {
    if (!this.data.store(id)) throw new Error("Векторное хранилище не найдено");
    if (this.data.hasProcessingDocuments(id))
      throw new Error("Дождитесь завершения обработки документов");
    await this.indexer.dropVectorStore(id);
    await rm(join(this.filesDir, String(id)), { recursive: true, force: true });
    this.data.clearDocuments(id);
    return this.snapshot();
  }

  async upload(inputs: UploadVectorDocumentInput[]) {
    const batchHashes = new Set<string>();
    for (const input of inputs) {
      this.validateUpload(input);
      const hash = createHash("sha256")
        .update(Buffer.from(input.data))
        .digest("hex");
      const batchKey = `${input.vectorStoreId}:${hash}`;
      if (batchHashes.has(batchKey))
        throw new Error(`Документ «${input.fileName}» выбран повторно`);
      batchHashes.add(batchKey);
      const existing = this.data.documentByHash(input.vectorStoreId, hash);
      if (existing && existing.status !== "failed")
        throw new Error(`Документ «${input.fileName}» уже добавлен`);
    }
    for (const input of inputs) {
      const buffer = Buffer.from(input.data);
      const hash = createHash("sha256").update(buffer).digest("hex");
      const dir = join(this.filesDir, String(input.vectorStoreId));
      const path = join(dir, `${hash}-${safeName(input.fileName)}`);
      const id = this.data.createDocument(
        input.vectorStoreId,
        input.fileName,
        input.mimeType,
        path,
        hash,
        buffer.length,
      );
      this.data.setStoreState(input.vectorStoreId, "indexing");
      this.beginBatch(input.vectorStoreId, 1);
      this.enqueueIngest({
        storeId: input.vectorStoreId,
        documentId: id,
        run: (generation) => this.ingest(input, id, path, buffer, generation),
      });
    }
    return this.snapshot();
  }

  async retryFailed(storeId: string) {
    const store = this.data.store(storeId);
    if (!store?.embeddingModelId)
      throw new Error("Сначала выберите embedding-модель");
    this.enqueueStored(this.data.failedDocuments(storeId));
    return this.snapshot();
  }

  resumeInterrupted(): void {
    const reset = this.indexer.initializeVectorIndex();
    this.indexer.resumeIndexing();
    this.paused = false;
    const rows = reset
      ? this.data.resetDocumentsForNativeIndex()
      : this.data.recoverInterruptedDocuments();
    if (reset) this.indexer.completeVectorIndexInitialization();
    this.enqueueStored(rows);
  }

  private enqueueStored(rows: StoredDocumentRow[]): void {
    if (!rows.length) return;
    for (const row of rows) this.data.updateDocument(row.id, "queued", 0);
    for (const [storeId, group] of groupByStore(rows)) {
      this.data.setStoreState(storeId, "indexing");
      this.beginBatch(storeId, group.length);
      for (const row of group)
        this.enqueueIngest({
          storeId,
          documentId: row.id,
          run: (generation) => this.reingest(row, generation),
        });
    }
  }

  private async reingest(
    row: StoredDocumentRow,
    generation: number,
  ): Promise<IngestOutcome> {
    let buffer: Buffer<ArrayBuffer>;
    try {
      buffer = (await readFile(row.local_path)) as Buffer<ArrayBuffer>;
    } catch {
      this.data.updateDocument(
        row.id,
        "failed",
        100,
        0,
        "Файл не найден на диске — возможно, его переместили или удалили.",
      );
      this.data.refreshStoreState(row.vector_store_id);
      return "failed";
    }
    return this.ingest(
      {
        vectorStoreId: row.vector_store_id,
        fileName: row.file_name,
        mimeType: row.mime_type,
        data: buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ),
      },
      row.id,
      row.local_path,
      buffer,
      generation,
    );
  }

  private enqueueIngest(entry: QueuedIngest): void {
    this.ingestQueue.push(entry);
    this.drainIngestQueue();
  }

  private beginBatch(storeId: string, added: number): void {
    const existing = this.batches.get(storeId);
    if (existing && !existing.cancelling) {
      existing.total += added;
      return;
    }
    this.batches.set(storeId, {
      total: added,
      completed: 0,
      failed: 0,
      startedAt: Date.now(),
      durations: [],
      cancelling: false,
    });
  }

  private finishOne(storeId: string, elapsedMs: number, failed: boolean): void {
    const batch = this.batches.get(storeId);
    if (!batch) return;
    batch.completed += 1;
    if (failed) batch.failed += 1;
    batch.durations.push(elapsedMs);
    if (batch.durations.length > DURATION_WINDOW) batch.durations.shift();
    if (batch.completed < batch.total) return;
    this.batches.delete(storeId);
    this.onBatchCompleted?.({
      storeId,
      storeName: this.data.store(storeId)?.name ?? "базу знаний",
      total: batch.total,
      succeeded: batch.completed - batch.failed,
      failed: batch.failed,
      elapsedMs: Date.now() - batch.startedAt,
      cancelled: batch.cancelling,
    });
    void this.indexer
      .finalizeVectorIndex(
        storeId,
        this.data.store(storeId)?.searchMode ?? "vector",
      )
      .catch((error: unknown) =>
        console.error(
          "Не удалось перестроить индекс хранилища",
          storeId,
          error,
        ),
      );
  }

  progress(storeId: string): IngestProgress | null {
    const batch = this.batches.get(storeId);
    if (!batch) return null;
    const active = this.activeByStore.get(storeId) ?? 0;
    const remaining = Math.max(0, batch.total - batch.completed);
    const averageMs = batch.durations.length
      ? batch.durations.reduce((sum, value) => sum + value, 0) /
        batch.durations.length
      : null;
    return {
      storeId,
      total: batch.total,
      completed: batch.completed,
      failed: batch.failed,
      remaining,
      active,
      averageMs: averageMs === null ? null : Math.round(averageMs),
      etaMs:
        averageMs === null || !remaining
          ? null
          : Math.round(
              (averageMs * remaining) / Math.max(1, INGEST_CONCURRENCY),
            ),
      startedAt: batch.startedAt,
      cancelling: batch.cancelling,
      paused: this.paused,
    };
  }

  stopIndexing() {
    if (this.paused) return this.snapshot();
    this.paused = true;
    this.stopGeneration += 1;
    this.indexer.stopIndexing();
    return this.snapshot();
  }

  resumeIndexing() {
    if (!this.paused) return this.snapshot();
    this.paused = false;
    this.indexer.resumeIndexing();
    for (const batch of this.batches.values()) batch.cancelling = false;
    this.drainIngestQueue();
    return this.snapshot();
  }

  private drainIngestQueue(): void {
    while (
      !this.paused &&
      this.activeIngests < INGEST_CONCURRENCY &&
      this.ingestQueue.length
    ) {
      const entry = this.ingestQueue.shift()!;
      this.activeIngests += 1;
      this.activeByStore.set(
        entry.storeId,
        (this.activeByStore.get(entry.storeId) ?? 0) + 1,
      );
      const startedAt = Date.now();
      const generation = this.stopGeneration;
      void entry
        .run(generation)
        .catch((): IngestOutcome => "failed")
        .then((outcome) => {
          this.activeIngests -= 1;
          const active = (this.activeByStore.get(entry.storeId) ?? 1) - 1;
          if (active > 0) this.activeByStore.set(entry.storeId, active);
          else this.activeByStore.delete(entry.storeId);
          if (outcome === "paused") {
            this.ingestQueue.unshift(entry);
          } else {
            this.finishOne(
              entry.storeId,
              Date.now() - startedAt,
              outcome === "failed",
            );
          }
          this.drainIngestQueue();
        });
    }
  }

  async deleteDocument(id: string) {
    const row = this.data.document(id);
    if (!row) return this.snapshot();
    if (isProcessing(String(row.status)))
      throw new Error("Документ ещё обрабатывается");
    const storeId = String(row.vector_store_id);
    await this.indexer.removeVectorDocument(storeId, id);
    await rm(String(row.local_path), { force: true });
    this.data.deleteDocument(id);
    this.data.refreshStoreState(storeId);
    return this.snapshot();
  }

  async search(input: VectorSearchInput): Promise<VectorSearchResultItem[]> {
    const query = input.query.trim();
    if (!query) throw new Error("Поисковый запрос пуст");
    if (!input.vectorStoreIds.length)
      throw new Error("Не выбрано векторное хранилище");
    if (
      input.scoreThreshold !== undefined &&
      (input.scoreThreshold < 0 || input.scoreThreshold > 1)
    )
      throw new Error("Порог релевантности должен быть от 0 до 1");
    const requestedLimit = input.limit ?? 5;
    if (!Number.isInteger(requestedLimit))
      throw new Error("Количество результатов должно быть целым числом");
    const limit = Math.min(Math.max(requestedLimit, 1), 20);
    const results: VectorSearchResultItem[] = [];
    const queryVectors = new Map<string, Promise<number[]>>();
    for (const storeId of [...new Set(input.vectorStoreIds)]) {
      const store = this.data.store(storeId);
      if (!store) throw new Error(`Векторное хранилище #${storeId} не найдено`);
      if (!store.embeddingModelId || store.status === "disabled")
        throw new Error(`Хранилище «${store.name}» не настроено`);
      let vectorPromise = queryVectors.get(store.embeddingModelId);
      if (!vectorPromise) {
        vectorPromise = this.embeddings
          .embed(store.embeddingModelId, [query])
          .then((vectors) => vectors[0]!);
        queryVectors.set(store.embeddingModelId, vectorPromise);
      }
      const vector = await vectorPromise;
      const rows = await this.indexer.searchVectorIndex(
        storeId,
        query,
        vector,
        store.searchMode,
        limit,
      );
      for (const row of rows) {
        const score = row.score;
        if (score < (input.scoreThreshold ?? 0)) continue;
        results.push({
          documentId: row.documentId,
          fileName: row.fileName,
          chunkIndex: row.chunkIndex,
          content: row.text,
          score,
          pageNumber:
            row.pageNumber < 1
              ? null
              : row.pageNumber,
        });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async ingest(
    input: UploadVectorDocumentInput,
    id: string,
    path: string,
    buffer: Buffer<ArrayBuffer>,
    generation: number,
  ): Promise<IngestOutcome> {
    const store = this.data.store(input.vectorStoreId);
    if (!store?.embeddingModelId)
      throw new Error("Сначала выберите embedding-модель");
    let failure: string | undefined;
    try {
      this.checkRunning(generation);
      await mkdir(join(this.filesDir, String(store.id)), { recursive: true });
      await writeFile(path, buffer);
      this.data.setStoreState(store.id, "indexing");
      this.stage(id, "reading");
      const segments = await this.extractSegments(path);
      this.checkRunning(generation);
      this.stage(id, "splitting");
      const chunks = segments.flatMap((segment) =>
        chunkText(
          segment.text,
          store.chunkSizeTokens,
          store.chunkOverlapTokens,
        ).map((text) => ({ text, pageNumber: segment.pageNumber })),
      );
      if (!chunks.length)
        throw new Error(
          "В документе не удалось найти текст. Если это скан, включите распознавание сканов в настройках базы знаний.",
        );
      this.stage(id, "embedding", 0);
      const vectors: number[][] = [];
      for (let index = 0; index < chunks.length; index += EMBED_BATCH) {
        this.checkRunning(generation);
        vectors.push(
          ...(await this.embeddings.embed(
            store.embeddingModelId,
            chunks.slice(index, index + EMBED_BATCH).map((chunk) => chunk.text),
          )),
        );
        this.checkRunning(generation);
        this.stage(
          id,
          "embedding",
          Math.min(index + EMBED_BATCH, chunks.length) / chunks.length,
        );
      }
      const rows: NativeVectorChunk[] = chunks.map((chunk, index) => ({
        id: `${id}:${index}`,
        documentId: id,
        chunkIndex: index,
        text: chunk.text,
        vector: vectors[index]!,
        fileName: input.fileName,
        pageNumber: chunk.pageNumber ?? -1,
      }));
      if (
        store.vectorDimension !== null &&
        store.vectorDimension !== vectors[0]!.length
      )
        throw new Error(
          `Размерность embedding изменилась: ожидалось ${store.vectorDimension}, получено ${vectors[0]!.length}`,
        );
      this.stage(id, "writing");
      this.checkRunning(generation);
      await this.indexer.appendVectorChunks(store.id, rows);
      this.checkRunning(generation);
      this.data.updateDocument(id, "ready", 100, chunks.length);
      this.data.refreshStoreState(store.id, vectors[0]!.length);
    } catch (error) {
      if (this.isPausedError(error, generation)) {
        this.data.updateDocument(id, "queued", 0);
        this.data.refreshStoreState(store.id);
        return "paused";
      }
      failure = error instanceof Error ? error.message : String(error);
      this.data.updateDocument(id, "failed", 100, 0, failure);
      this.data.refreshStoreState(store.id);
    }
    return failure === undefined ? "succeeded" : "failed";
  }

  private checkRunning(generation: number): void {
    if (this.paused || generation !== this.stopGeneration)
      throw new IndexingPausedError();
  }

  private isPausedError(error: unknown, generation: number): boolean {
    return (
      error instanceof IndexingPausedError ||
      (error instanceof Error && error.message.includes("INDEXING_PAUSED")) ||
      this.paused ||
      generation !== this.stopGeneration
    );
  }

  private stage(
    documentId: string,
    name: DocumentStageName,
    fraction = 1,
  ): void {
    const { status, progress } = stageProgress(name, fraction);
    this.data.updateDocument(documentId, status, progress);
  }

  private async extractSegments(
    path: string,
  ): Promise<Array<{ text: string; pageNumber: number | null }>> {
    if (!this.indexer.supportsNativeExtraction())
      throw new Error(
        "Часть программы, которая читает документы, не установлена. Переустановите приложение.",
      );
    const extracted = await this.indexer.extractDocument(path, true);
    return extracted.pages
      .filter((page) => page.text.trim().length > 0)
      .map((page) => ({
        text: page.text,
        pageNumber: page.pageNumber > 0 ? page.pageNumber : null,
      }));
  }

  private validateUpload(input: UploadVectorDocumentInput) {
    const store = this.data.store(input.vectorStoreId);
    if (!store?.embeddingModelId)
      throw new Error("Сначала выберите embedding-модель");
    if (
      !isBuiltinEmbeddingModelId(store.embeddingModelId) &&
      !this.data.embeddingModel(store.embeddingModelId)
    )
      throw new Error("Embedding-провайдер или модель отключены");
    if (!/\.(pdf|docx|txt)$/i.test(input.fileName))
      throw new Error(`Формат ${input.fileName} не поддерживается`);
    if (!input.data.byteLength)
      throw new Error(`Документ «${input.fileName}» пуст`);
    if (input.data.byteLength > MAX_VECTOR_DOCUMENT_BYTES)
      throw new Error(
        `Документ «${input.fileName}» больше ${Math.round(MAX_VECTOR_DOCUMENT_BYTES / 1_048_576)} МБ`,
      );
  }
}

class IndexingPausedError extends Error {}

function groupByStore(rows: StoredDocumentRow[]) {
  const groups = new Map<string, StoredDocumentRow[]>();
  for (const row of rows) {
    const group = groups.get(row.vector_store_id);
    if (group) group.push(row);
    else groups.set(row.vector_store_id, [row]);
  }
  return groups;
}

const safeName = (name: string) =>
  name.replace(/[^a-zA-Zа-яА-Я0-9._-]+/g, "_").slice(-120);

function chunkText(text: string, sizeTokens: number, overlapTokens: number) {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
  const size = sizeTokens * 4;
  const overlap = Math.min(overlapTokens * 4, Math.floor(size / 2));
  const chunks: string[] = [];
  for (let start = 0; start < normalized.length; start += size - overlap) {
    const chunk = normalized.slice(start, start + size).trim();
    if (chunk.length >= 40) chunks.push(chunk);
    if (start + size >= normalized.length) break;
  }
  return chunks;
}

function validateStore(input: UpsertVectorStoreInput) {
  if (!input.name.trim()) throw new Error("Название обязательно");
  if (input.chunkSizeTokens < 100 || input.chunkSizeTokens > 4096)
    throw new Error("Размер чанка должен быть от 100 до 4096 токенов");
  if (
    input.chunkOverlapTokens < 0 ||
    input.chunkOverlapTokens > input.chunkSizeTokens / 2
  )
    throw new Error("Перекрытие не может превышать половину чанка");
}
