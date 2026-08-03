import type Database from "better-sqlite3";
import type {
  UpsertVectorStoreInput,
  VectorStoreConfig,
  VectorStoreDocument,
  VectorStoreSnapshot,
  VectorDocumentStatus,
} from "../../domain/models/vector-store";

export class VectorStoreDataSource {
  constructor(readonly db: Database.Database) {}
  snapshot(): VectorStoreSnapshot {
    return {
      stores: (
        this.db
          .prepare("SELECT * FROM vector_stores ORDER BY updated_at DESC")
          .all() as Record<string, unknown>[]
      ).map(mapStore),
      documents: (
        this.db
          .prepare(
            "SELECT * FROM vector_store_documents ORDER BY created_at DESC",
          )
          .all() as Record<string, unknown>[]
      ).map(mapDocument),
    };
  }
  documents(ids: number[]) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    return (
      this.db
        .prepare(
          `SELECT * FROM vector_store_documents WHERE id IN (${placeholders})`,
        )
        .all(...ids) as Record<string, unknown>[]
    ).map(mapDocument);
  }
  store(id: number) {
    const row = this.db
      .prepare("SELECT * FROM vector_stores WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? mapStore(row) : undefined;
  }
  upsert(input: UpsertVectorStoreInput) {
    if (input.id === undefined)
      return Number(
        this.db
          .prepare(
            "INSERT INTO vector_stores(name,description,embedding_model_id,search_mode,chunk_size_tokens,chunk_overlap_tokens,status) VALUES(?,?,?,?,?,?,CASE WHEN ? IS NULL THEN 'disabled' ELSE 'ready' END)",
          )
          .run(
            input.name,
            input.description,
            input.embeddingModelId,
            input.searchMode,
            input.chunkSizeTokens,
            input.chunkOverlapTokens,
            input.embeddingModelId,
          ).lastInsertRowid,
      );
    const current = this.store(input.id);
    if (!current) throw new Error("Векторное хранилище не найдено");
    if (
      this.hasDocuments(input.id) &&
      (current.embeddingModelId !== input.embeddingModelId ||
        current.chunkSizeTokens !== input.chunkSizeTokens ||
        current.chunkOverlapTokens !== input.chunkOverlapTokens)
    )
      throw new Error(
        "Перед изменением параметров векторизации удалите документы из хранилища",
      );
    const result = this.db
      .prepare(
        "UPDATE vector_stores SET name=?,description=?,vector_dimension=CASE WHEN embedding_model_id IS NOT ? THEN NULL ELSE vector_dimension END,embedding_model_id=?,search_mode=?,chunk_size_tokens=?,chunk_overlap_tokens=?,status=CASE WHEN ? IS NULL THEN 'disabled' WHEN status='disabled' THEN 'ready' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(
        input.name,
        input.description,
        input.embeddingModelId,
        input.embeddingModelId,
        input.searchMode,
        input.chunkSizeTokens,
        input.chunkOverlapTokens,
        input.embeddingModelId,
        input.id,
      );
    if (!result.changes) throw new Error("Векторное хранилище не найдено");
    return input.id;
  }
  deleteStore(id: number) {
    this.db.prepare("DELETE FROM vector_stores WHERE id=?").run(id);
  }
  hasDocuments(storeId: number) {
    return Boolean(
      this.db
        .prepare(
          "SELECT 1 FROM vector_store_documents WHERE vector_store_id=? LIMIT 1",
        )
        .get(storeId),
    );
  }
  hasProcessingDocuments(storeId: number) {
    return Boolean(
      this.db
        .prepare(
          "SELECT 1 FROM vector_store_documents WHERE vector_store_id=? AND status IN ('queued','extracting','embedding') LIMIT 1",
        )
        .get(storeId),
    );
  }
  recoverInterruptedDocuments() {
    const storeIds = (
      this.db
        .prepare(
          "SELECT DISTINCT vector_store_id FROM vector_store_documents WHERE status IN ('queued','extracting','embedding')",
        )
        .all() as Array<{ vector_store_id: number }>
    ).map((item) => item.vector_store_id);
    this.db
      .prepare(
        "UPDATE vector_store_documents SET status='failed',error_message='Обработка была прервана перезапуском приложения' WHERE status IN ('queued','extracting','embedding')",
      )
      .run();
    for (const storeId of storeIds) this.refreshStoreState(storeId);
  }
  createDocument(
    storeId: number,
    fileName: string,
    mimeType: string,
    path: string,
    hash: string,
    size: number,
  ) {
    const existing = this.documentByHash(storeId, hash);
    if (existing) {
      if (existing.status !== "failed")
        throw new Error("Документ уже добавлен");
      this.db
        .prepare(
          "UPDATE vector_store_documents SET file_name=?,mime_type=?,local_path=?,size=?,status='queued',progress=0,chunk_count=0,error_message=NULL,created_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(fileName, mimeType, path, size, existing.id);
      return existing.id;
    }
    return Number(
      this.db
        .prepare(
          "INSERT INTO vector_store_documents(vector_store_id,file_name,mime_type,local_path,content_hash,size) VALUES(?,?,?,?,?,?)",
        )
        .run(storeId, fileName, mimeType, path, hash, size).lastInsertRowid,
    );
  }
  documentByHash(storeId: number, hash: string) {
    return this.db
      .prepare(
        "SELECT id,status FROM vector_store_documents WHERE vector_store_id=? AND content_hash=?",
      )
      .get(storeId, hash) as
      | { id: number; status: VectorDocumentStatus }
      | undefined;
  }
  document(id: number) {
    return this.db
      .prepare("SELECT * FROM vector_store_documents WHERE id=?")
      .get(id) as Record<string, unknown> | undefined;
  }
  deleteDocument(id: number) {
    this.db.prepare("DELETE FROM vector_store_documents WHERE id=?").run(id);
  }
  updateDocument(
    id: number,
    status: VectorDocumentStatus,
    progress: number,
    chunkCount = 0,
    error?: string,
  ) {
    this.db
      .prepare(
        "UPDATE vector_store_documents SET status=?,progress=?,chunk_count=?,error_message=? WHERE id=?",
      )
      .run(status, progress, chunkCount, error ?? null, id);
  }
  setStoreState(
    id: number,
    status: VectorStoreConfig["status"],
    dimension?: number,
  ) {
    this.db
      .prepare(
        "UPDATE vector_stores SET status=?,vector_dimension=COALESCE(?,vector_dimension),updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(status, dimension ?? null, id);
  }
  refreshStoreState(id: number, dimension?: number) {
    const statuses = this.db
      .prepare("SELECT status FROM vector_store_documents WHERE vector_store_id=?")
      .all(id) as Array<{ status: VectorDocumentStatus }>;
    const status: VectorStoreConfig["status"] = statuses.some((item) =>
      ["queued", "extracting", "embedding"].includes(item.status),
    )
      ? "indexing"
      : statuses.some((item) => item.status === "failed")
        ? "degraded"
        : this.store(id)?.embeddingModelId
          ? "ready"
          : "disabled";
    this.setStoreState(id, status, dimension);
  }
  embeddingModel(id: number) {
    return this.db
      .prepare(
        `SELECT m.remote_id,p.kind,p.base_url,p.api_key_secret_id FROM text_provider_models m JOIN text_provider_configs p ON p.id=m.provider_id WHERE m.id=? AND m.enabled=1 AND p.enabled=1 AND p.provider_type='embedding'`,
      )
      .get(id) as
      | {
          remote_id: string;
          kind: "ollama" | "openrouter";
          base_url: string;
          api_key_secret_id: number | null;
        }
      | undefined;
  }
}
const mapStore = (r: Record<string, unknown>): VectorStoreConfig => ({
  id: Number(r.id),
  name: String(r.name),
  description: String(r.description),
  embeddingModelId:
    r.embedding_model_id === null ? null : Number(r.embedding_model_id),
  status: r.status as VectorStoreConfig["status"],
  searchMode: r.search_mode as VectorStoreConfig["searchMode"],
  chunkSizeTokens: Number(r.chunk_size_tokens),
  chunkOverlapTokens: Number(r.chunk_overlap_tokens),
  vectorDimension:
    r.vector_dimension === null ? null : Number(r.vector_dimension),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const mapDocument = (r: Record<string, unknown>): VectorStoreDocument => ({
  id: Number(r.id),
  vectorStoreId: Number(r.vector_store_id),
  fileName: String(r.file_name),
  mimeType: String(r.mime_type),
  size: Number(r.size),
  status: r.status as VectorStoreDocument["status"],
  progress: Number(r.progress),
  chunkCount: Number(r.chunk_count),
  createdAt: String(r.created_at),
  errorMessage: r.error_message === null ? null : String(r.error_message),
});
