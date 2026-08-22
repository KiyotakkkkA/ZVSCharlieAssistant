import type Database from "better-sqlite3";
import { parseJsonDto, stringArrayDtoSchema } from "../../../shared/dto";
import type {
  MemoryEntry,
  MemoryKind,
  MemoryPolicy,
  MemorySource,
} from "../../../shared/models/memory";
import { newEntityId } from "./entity-id";
import { GLOBAL_ENTITY_IDS } from "../../../shared/entity-ids";

interface MemoryRow {
  id: string;
  kind: MemoryKind;
  title: string;
  content: string;
  tags_json: string;
  source: MemorySource;
  conversation_id: string | null;
  execution_id: string | null;
  agent_id: string | null;
  pinned: number;
  hits: number;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

const mapEntry = (row: MemoryRow): MemoryEntry => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  content: row.content,
  tags: parseJsonDto(stringArrayDtoSchema, row.tags_json),
  source: row.source,
  conversationId: row.conversation_id,
  executionId: row.execution_id,
  agentId: row.agent_id,
  pinned: Boolean(row.pinned),
  hits: row.hits,
  usedAt: row.used_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toMatchQuery = (query: string): string =>
  query
    .split(/\s+/)
    .map((term) => term.replace(/["*^:()-]/g, "").trim())
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(" OR ");

export class MemoryRepository {
  constructor(private readonly db: Database.Database) {}

  policy(): MemoryPolicy {
    const row = this.db
      .prepare("SELECT * FROM memory_policy WHERE id=?")
      .get(GLOBAL_ENTITY_IDS.memoryPolicy) as Record<string, number | string>;
    return {
      enabled: Boolean(row.enabled),
      autosave: Boolean(row.autosave),
      allowScenarioWrites: Boolean(row.allow_scenario_writes),
      maxEntries: Number(row.max_entries),
      maxContentChars: Number(row.max_content_chars),
      injectedEntries: Number(row.injected_entries),
      updatedAt: String(row.updated_at),
    };
  }

  upsertPolicy(input: Omit<MemoryPolicy, "updatedAt">): MemoryPolicy {
    if (
      !Number.isInteger(input.maxEntries) ||
      input.maxEntries < 1 ||
      input.maxEntries > 10_000
    )
      throw new Error("Лимит записей должен быть от 1 до 10 000");
    if (
      !Number.isInteger(input.maxContentChars) ||
      input.maxContentChars < 100 ||
      input.maxContentChars > 20_000
    )
      throw new Error("Размер записи должен быть от 100 до 20 000 символов");
    if (
      !Number.isInteger(input.injectedEntries) ||
      input.injectedEntries < 0 ||
      input.injectedEntries > 50
    )
      throw new Error("В контекст можно передавать от 0 до 50 записей");
    this.db
      .prepare(
        `UPDATE memory_policy SET enabled=?, autosave=?, allow_scenario_writes=?,
           max_entries=?, max_content_chars=?, injected_entries=?,
           updated_at=CURRENT_TIMESTAMP
         WHERE id=?`,
      )
      .run(
        Number(input.enabled),
        Number(input.autosave),
        Number(input.allowScenarioWrites),
        input.maxEntries,
        input.maxContentChars,
        input.injectedEntries,
        GLOBAL_ENTITY_IDS.memoryPolicy,
      );
    return this.policy();
  }

  list(limit = 200): MemoryEntry[] {
    return (
      this.db
        .prepare(
          `SELECT * FROM memory_entries
           ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
        )
        .all(limit) as MemoryRow[]
    ).map(mapEntry);
  }

  count(): number {
    return Number(
      (
        this.db.prepare("SELECT COUNT(*) c FROM memory_entries").get() as {
          c: number;
        }
      ).c,
    );
  }

  find(id: string): MemoryEntry | undefined {
    const row = this.db
      .prepare("SELECT * FROM memory_entries WHERE id=?")
      .get(id) as MemoryRow | undefined;
    return row ? mapEntry(row) : undefined;
  }

  findByTitle(title: string): MemoryEntry | undefined {
    const row = this.db
      .prepare("SELECT * FROM memory_entries WHERE title=?")
      .get(title) as MemoryRow | undefined;
    return row ? mapEntry(row) : undefined;
  }

  contextEntries(limit: number): MemoryEntry[] {
    if (limit <= 0) return [];
    return (
      this.db
        .prepare(
          `SELECT * FROM memory_entries
           ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
        )
        .all(limit) as MemoryRow[]
    ).map(mapEntry);
  }

  search(query: string, limit: number): MemoryEntry[] {
    const match = toMatchQuery(query);
    if (!match) return [];
    const rows = this.db
      .prepare(
        `SELECT e.* FROM memory_search s
         JOIN memory_entries e ON e.search_rowid = s.rowid
         WHERE memory_search MATCH ?
         ORDER BY bm25(memory_search), e.pinned DESC
         LIMIT ?`,
      )
      .all(match, limit) as MemoryRow[];
    if (rows.length) this.registerHits(rows.map((row) => row.id));
    return rows.map(mapEntry);
  }

  private registerHits(ids: string[]): void {
    const update = this.db.prepare(
      "UPDATE memory_entries SET hits=hits+1, used_at=CURRENT_TIMESTAMP WHERE id=?",
    );
    this.db.transaction(() => {
      for (const id of ids) update.run(id);
    })();
  }

  upsert(input: {
    id?: string;
    kind: MemoryKind;
    title: string;
    content: string;
    tags: string[];
    source: MemorySource;
    conversationId?: string | null;
    executionId?: string | null;
    agentId?: string | null;
    pinned?: boolean;
  }): { entry: MemoryEntry; created: boolean } {
    const tags = JSON.stringify([
      ...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)),
    ]);
    const existing =
      input.id !== undefined
        ? this.find(input.id)
        : this.findByTitle(input.title);
    if (existing) {
      this.db
        .prepare(
          `UPDATE memory_entries SET kind=?, title=?, content=?, tags_json=?,
             pinned=COALESCE(?, pinned), updated_at=CURRENT_TIMESTAMP
           WHERE id=?`,
        )
        .run(
          input.kind,
          input.title,
          input.content,
          tags,
          input.pinned === undefined ? null : Number(input.pinned),
          existing.id,
        );
      return { entry: this.find(existing.id)!, created: false };
    }
    const id = input.id ?? newEntityId();
    this.db
      .prepare(
        `INSERT INTO memory_entries
           (id,kind,title,content,tags_json,source,conversation_id,execution_id,agent_id,pinned)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        id,
        input.kind,
        input.title,
        input.content,
        tags,
        input.source,
        input.conversationId ?? null,
        input.executionId ?? null,
        input.agentId ?? null,
        Number(input.pinned ?? false),
      );
    return { entry: this.find(id)!, created: true };
  }

  setPinned(id: string, pinned: boolean): void {
    const result = this.db
      .prepare(
        "UPDATE memory_entries SET pinned=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(Number(pinned), id);
    if (!result.changes) throw new Error("Запись памяти не найдена");
  }

  remove(id: string): void {
    const result = this.db
      .prepare("DELETE FROM memory_entries WHERE id=?")
      .run(id);
    if (!result.changes) throw new Error("Запись памяти не найдена");
  }

  clear(): number {
    return this.db.prepare("DELETE FROM memory_entries WHERE pinned=0").run()
      .changes;
  }

  evictOverflow(maxEntries: number): number {
    return this.db
      .prepare(
        `DELETE FROM memory_entries WHERE id IN (
           SELECT id FROM memory_entries WHERE pinned=0
           ORDER BY updated_at DESC LIMIT -1 OFFSET ?
         )`,
      )
      .run(Math.max(0, maxEntries)).changes;
  }
}
