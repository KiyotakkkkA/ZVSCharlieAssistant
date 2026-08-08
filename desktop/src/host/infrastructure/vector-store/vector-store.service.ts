import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as lancedb from "@lancedb/lancedb";
import mammoth from "mammoth";
import type {
  UploadVectorDocumentInput,
  UpsertVectorStoreInput,
  VectorSearchInput,
} from "../../../shared/dto";
import type { VectorSearchResultItem } from "../../../shared/models/vector-store";
import type { VectorStoreRepository } from "../database/vector-store.repository";
import { EmbeddingService } from "./embedding.service";

export class VectorStoreService {
  private readonly writeQueues = new Map<number, Promise<void>>();
  private readonly ftsIndexPromises = new Map<number, Promise<void>>();
  private connectionPromise?: Promise<lancedb.Connection>;
  private tableNamesPromise?: Promise<Set<string>>;
  private rrfPromise?: ReturnType<typeof lancedb.rerankers.RRFReranker.create>;

  constructor(
    private readonly data: VectorStoreRepository,
    private readonly embeddings: EmbeddingService,
    private readonly filesDir: string,
    private readonly lanceDir: string,
  ) {}

  snapshot() {
    return this.data.snapshot();
  }

  documents(ids: number[]) {
    const uniqueIds = [...new Set(ids)];
    if (
      uniqueIds.length > 100 ||
      uniqueIds.some((id) => !Number.isInteger(id) || id < 1)
    )
      throw new Error("Некорректный список документов");
    return this.data.documents(uniqueIds);
  }

  async upsert(input: UpsertVectorStoreInput) {
    validateStore(input);
    if (
      input.embeddingModelId !== null &&
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
    if (embeddingChanged) {
      const db = await this.connect();
      const name = tableName(current.id);
      const tables = await this.tableNames();
      if (tables.has(name)) {
        await db.dropTable(name);
        tables.delete(name);
      }
    }
    const storeId = this.data.upsert({
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
    });
    if (input.searchMode === "hybrid") {
      const tables = await this.tableNames();
      if (tables.has(tableName(storeId))) {
        const table = await (
          await this.connect()
        ).openTable(tableName(storeId));
        this.ftsIndexPromises.delete(storeId);
        await this.ensureFtsIndex(storeId, table);
      }
    }
    return this.snapshot();
  }

  async deleteStore(id: number) {
    if (this.data.hasProcessingDocuments(id))
      throw new Error("Дождитесь завершения обработки документов");
    const db = await this.connect();
    const table = tableName(id);
    const tables = await this.tableNames();
    if (tables.has(table)) {
      await db.dropTable(table);
      tables.delete(table);
    }
    this.ftsIndexPromises.delete(id);
    await rm(join(this.filesDir, String(id)), { recursive: true, force: true });
    this.data.deleteStore(id);
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
    for (const input of inputs) void this.ingest(input).catch(() => undefined);
    return this.snapshot();
  }

  async deleteDocument(id: number) {
    const row = this.data.document(id);
    if (!row) return this.snapshot();
    if (["queued", "extracting", "embedding"].includes(String(row.status)))
      throw new Error("Документ ещё обрабатывается");
    const storeId = Number(row.vector_store_id);
    const db = await this.connect();
    if ((await this.tableNames()).has(tableName(storeId)))
      await (
        await db.openTable(tableName(storeId))
      ).delete(`document_id = ${id}`);
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
    if (input.vectorStoreIds.some((id) => !Number.isInteger(id) || id < 1))
      throw new Error("Передан некорректный идентификатор хранилища");
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
    const db = await this.connect();
    const tableNames = await this.tableNames();
    const queryVectors = new Map<number, Promise<number[]>>();
    for (const storeId of [...new Set(input.vectorStoreIds)]) {
      const store = this.data.store(storeId);
      if (!store) throw new Error(`Векторное хранилище #${storeId} не найдено`);
      if (!store.embeddingModelId || store.status === "disabled")
        throw new Error(`Хранилище «${store.name}» не настроено`);
      if (!tableNames.has(tableName(storeId))) continue;
      let vectorPromise = queryVectors.get(store.embeddingModelId);
      if (!vectorPromise) {
        vectorPromise = this.embeddings
          .embed(store.embeddingModelId, [query])
          .then((vectors) => vectors[0]!);
        queryVectors.set(store.embeddingModelId, vectorPromise);
      }
      const vector = await vectorPromise;
      const table = await db.openTable(tableName(storeId));
      if (store.searchMode === "hybrid")
        await this.ensureFtsIndex(storeId, table);
      const rows = (await (store.searchMode === "hybrid"
        ? table
            .query()
            .nearestTo(vector!)
            .fullTextSearch(query, { columns: ["text"] })
            .rerank(await this.rrf())
            .limit(limit)
            .toArray()
        : table.vectorSearch(vector!).limit(limit).toArray())) as Array<
        Record<string, unknown>
      >;
      for (const row of rows) {
        const score =
          store.searchMode === "hybrid"
            ? Math.min(
                1,
                Math.max(0, Number(row._relevance_score ?? 0) / (2 / 60)),
              )
            : 1 / (1 + Number(row._distance ?? 0));
        if (score < (input.scoreThreshold ?? 0)) continue;
        results.push({
          documentId: Number(row.document_id),
          fileName: String(row.file_name),
          chunkIndex: Number(row.chunk_index),
          content: String(row.text),
          score,
          pageNumber:
            row.page_number === null || Number(row.page_number) < 1
              ? null
              : Number(row.page_number),
        });
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private async ingest(input: UploadVectorDocumentInput) {
    const store = this.data.store(input.vectorStoreId);
    if (!store?.embeddingModelId)
      throw new Error("Сначала выберите embedding-модель");
    if (!/\.(pdf|docx|txt)$/i.test(input.fileName))
      throw new Error(`Формат ${input.fileName} не поддерживается`);
    const buffer = Buffer.from(input.data);
    const hash = createHash("sha256").update(buffer).digest("hex");
    const dir = join(this.filesDir, String(store.id));
    const path = join(dir, `${hash}-${safeName(input.fileName)}`);
    const id = this.data.createDocument(
      store.id,
      input.fileName,
      input.mimeType,
      path,
      hash,
      buffer.length,
    );
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path, buffer);
      this.data.setStoreState(store.id, "indexing");
      this.data.updateDocument(id, "extracting", 15);
      const text = await extractText(buffer, input.fileName);
      const chunks = chunkText(
        text,
        store.chunkSizeTokens,
        store.chunkOverlapTokens,
      );
      if (!chunks.length) throw new Error("В документе не найден текст");
      this.data.updateDocument(id, "embedding", 40);
      const vectors: number[][] = [];
      for (let index = 0; index < chunks.length; index += 16) {
        vectors.push(
          ...(await this.embeddings.embed(
            store.embeddingModelId,
            chunks.slice(index, index + 16),
          )),
        );
        this.data.updateDocument(
          id,
          "embedding",
          40 +
            Math.round(
              (Math.min(index + 16, chunks.length) / chunks.length) * 50,
            ),
        );
      }
      const rows = chunks.map((text, index) => ({
        id: `${id}:${index}`,
        document_id: id,
        chunk_index: index,
        text,
        vector: vectors[index]!,
        file_name: input.fileName,
        // Keep this numeric so Arrow can infer the schema. A negative value
        // represents a chunk without page metadata.
        page_number: -1,
      }));
      if (
        store.vectorDimension !== null &&
        store.vectorDimension !== vectors[0]!.length
      )
        throw new Error(
          `Размерность embedding изменилась: ожидалось ${store.vectorDimension}, получено ${vectors[0]!.length}`,
        );
      await this.writeRows(store.id, id, rows);
      this.data.updateDocument(id, "ready", 100, chunks.length);
      this.data.refreshStoreState(store.id, vectors[0]!.length);
    } catch (error) {
      this.data.updateDocument(
        id,
        "failed",
        100,
        0,
        error instanceof Error ? error.message : String(error),
      );
      this.data.refreshStoreState(store.id);
    }
  }

  private validateUpload(input: UploadVectorDocumentInput) {
    const store = this.data.store(input.vectorStoreId);
    if (!store?.embeddingModelId)
      throw new Error("Сначала выберите embedding-модель");
    if (!this.data.embeddingModel(store.embeddingModelId))
      throw new Error("Embedding-провайдер или модель отключены");
    if (!/\.(pdf|docx|txt)$/i.test(input.fileName))
      throw new Error(`Формат ${input.fileName} не поддерживается`);
    if (!input.data.byteLength)
      throw new Error(`Документ «${input.fileName}» пуст`);
  }

  private async writeRows(
    storeId: number,
    documentId: number,
    rows: Array<Record<string, unknown>>,
  ) {
    const previous = this.writeQueues.get(storeId) ?? Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(async () => {
        const db = await this.connect();
        const name = tableName(storeId);
        const tables = await this.tableNames();
        if (tables.has(name)) {
          const table = await db.openTable(name);
          await table.delete(`document_id = ${documentId}`);
          await table.add(rows);
          if (this.data.store(storeId)?.searchMode === "hybrid") {
            this.ftsIndexPromises.delete(storeId);
            await this.ensureFtsIndex(storeId, table);
          }
        } else {
          const table = await db.createTable(name, rows);
          tables.add(name);
          if (this.data.store(storeId)?.searchMode === "hybrid")
            await this.ensureFtsIndex(storeId, table);
        }
      });
    this.writeQueues.set(storeId, current);
    try {
      await current;
    } finally {
      if (this.writeQueues.get(storeId) === current)
        this.writeQueues.delete(storeId);
    }
  }

  private connect() {
    if (!this.connectionPromise)
      this.connectionPromise = lancedb.connect(this.lanceDir).catch((error) => {
        this.connectionPromise = undefined;
        throw error;
      });
    return this.connectionPromise;
  }

  private ensureFtsIndex(storeId: number, table: lancedb.Table) {
    let pending = this.ftsIndexPromises.get(storeId);
    if (!pending) {
      pending = table
        .createIndex("text", {
          config: lancedb.Index.fts({
            baseTokenizer: "simple",
            lowercase: true,
            stem: false,
            removeStopWords: false,
          }),
          replace: true,
          waitTimeoutSeconds: 60,
        })
        .catch((error) => {
          this.ftsIndexPromises.delete(storeId);
          throw error;
        });
      this.ftsIndexPromises.set(storeId, pending);
    }
    return pending;
  }

  private rrf() {
    if (!this.rrfPromise)
      this.rrfPromise = lancedb.rerankers.RRFReranker.create(60).catch(
        (error) => {
          this.rrfPromise = undefined;
          throw error;
        },
      );
    return this.rrfPromise;
  }

  private tableNames() {
    if (!this.tableNamesPromise)
      this.tableNamesPromise = this.connect()
        .then(async (db) => new Set(await db.tableNames()))
        .catch((error) => {
          this.tableNamesPromise = undefined;
          throw error;
        });
    return this.tableNamesPromise;
  }
}

const tableName = (id: number) => `vector_store_${id}`;
const safeName = (name: string) =>
  name.replace(/[^a-zA-Zа-яА-Я0-9._-]+/g, "_").slice(-120);

async function extractText(buffer: Buffer, name: string) {
  if (/\.txt$/i.test(name)) return buffer.toString("utf8");
  if (/\.docx$/i.test(name))
    return (await mammoth.extractRawText({ buffer })).value;
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    const content = await (await pdf.getPage(index)).getTextContent();
    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }
  return pages.join("\n\n");
}

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
