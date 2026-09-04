import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { TextProviderKind } from "../../../shared/dto";

const CATALOG_URL = "https://models.dev/api.json";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 25_000;

const CATALOG_PROVIDER_IDS: Record<TextProviderKind, string[]> = {
  openrouter: ["openrouter"],
  mistral: ["mistral"],
  ollama: ["ollama-cloud"],
};

const OPEN_WEIGHT_FALLBACK_KINDS: TextProviderKind[] = ["ollama"];

interface CatalogModel {
  id?: string;
  name?: string;
  description?: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  knowledge?: string;
  release_date?: string;
  last_updated?: string;
  open_weights?: boolean;
  modalities?: { input?: string[]; output?: string[] };
  limit?: { context?: number; output?: number };
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
}

interface CatalogProvider {
  id?: string;
  name?: string;
  doc?: string;
  models?: Record<string, CatalogModel>;
}

type CatalogPayload = Record<string, CatalogProvider>;

interface CachedCatalog {
  etag: string | null;
  fetchedAt: number;
  payload: CatalogPayload;
}

export interface ModelsDevEntry {
  contextLength?: number;
  maxCompletionTokens?: number;
  inputModalities?: string[];
  outputModalities?: string[];
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  supportsReasoning?: boolean;
  supportsVision?: boolean;
  promptPrice?: string;
  completionPrice?: string;
  cachedInputPrice?: string;
  family?: string;
  description?: string;
  knowledgeCutoff?: string;
  releaseDate?: string;
  lastUpdated?: string;
  openWeights?: boolean;
  catalogUrl?: string;
}

interface CatalogIndex {
  byProvider: Map<string, Map<string, ModelsDevEntry>>;
  openWeights: Map<string, ModelsDevEntry>;
}

export class ModelsDevCatalog {
  private index: CatalogIndex | null = null;
  private fetchedAt = 0;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly cacheFile: string,
    private readonly refreshIntervalMs: number = REFRESH_INTERVAL_MS,
  ) {}

  async entriesFor(
    kind: TextProviderKind,
    modelIds: string[],
  ): Promise<Map<string, ModelsDevEntry>> {
    const index = await this.ensureIndex();
    const result = new Map<string, ModelsDevEntry>();
    if (!index) return result;
    const scoped = CATALOG_PROVIDER_IDS[kind]
      .map((providerId) => index.byProvider.get(providerId))
      .filter((value): value is Map<string, ModelsDevEntry> => Boolean(value));
    const allowFallback = OPEN_WEIGHT_FALLBACK_KINDS.includes(kind);
    for (const modelId of modelIds) {
      const entry =
        lookup(scoped, modelId) ??
        (allowFallback ? lookup([index.openWeights], modelId) : undefined);
      if (entry) result.set(modelId, entry);
    }
    return result;
  }

  private async ensureIndex(): Promise<CatalogIndex | null> {
    if (this.index && Date.now() - this.fetchedAt < this.refreshIntervalMs)
      return this.index;
    this.pending ??= this.refresh().finally(() => {
      this.pending = null;
    });
    await this.pending;
    return this.index;
  }

  private async refresh(): Promise<void> {
    const cached = await this.readCache();
    if (cached && Date.now() - cached.fetchedAt < this.refreshIntervalMs) {
      this.adopt(cached.payload, cached.fetchedAt);
      return;
    }
    try {
      const response = await fetch(CATALOG_URL, {
        headers: cached?.etag ? { "If-None-Match": cached.etag } : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status === 304 && cached) {
        this.adopt(cached.payload, Date.now());
        await this.writeCache({ ...cached, fetchedAt: Date.now() });
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const payload = (await response.json()) as CatalogPayload;
      if (!payload || typeof payload !== "object") throw new Error("payload");
      const fetchedAt = Date.now();
      this.adopt(payload, fetchedAt);
      await this.writeCache({
        etag: response.headers.get("etag"),
        fetchedAt,
        payload,
      });
    } catch {
      if (cached) this.adopt(cached.payload, Date.now());
      else if (!this.index) this.fetchedAt = Date.now();
    }
  }

  private adopt(payload: CatalogPayload, fetchedAt: number): void {
    this.index = buildIndex(payload);
    this.fetchedAt = fetchedAt;
  }

  private async readCache(): Promise<CachedCatalog | null> {
    try {
      const raw = await readFile(this.cacheFile, "utf8");
      const parsed = JSON.parse(raw) as CachedCatalog;
      if (!parsed?.payload || typeof parsed.payload !== "object") return null;
      return {
        etag: typeof parsed.etag === "string" ? parsed.etag : null,
        fetchedAt: Number(parsed.fetchedAt) || 0,
        payload: parsed.payload,
      };
    } catch {
      return null;
    }
  }

  private async writeCache(value: CachedCatalog): Promise<void> {
    try {
      await mkdir(dirname(this.cacheFile), { recursive: true });
      await writeFile(this.cacheFile, JSON.stringify(value), "utf8");
    } catch {
      return;
    }
  }
}

function buildIndex(payload: CatalogPayload): CatalogIndex {
  const byProvider = new Map<string, Map<string, ModelsDevEntry>>();
  const openWeights = new Map<string, ModelsDevEntry>();
  for (const [providerId, provider] of Object.entries(payload)) {
    if (!provider?.models) continue;
    const models = new Map<string, ModelsDevEntry>();
    for (const [modelId, model] of Object.entries(provider.models)) {
      const entry = toEntry(model, provider);
      for (const key of indexKeys(modelId)) {
        if (!models.has(key)) models.set(key, entry);
        if (model.open_weights === true && !openWeights.has(key))
          openWeights.set(key, entry);
      }
    }
    byProvider.set(providerId, models);
  }
  return { byProvider, openWeights };
}

function toEntry(
  model: CatalogModel,
  provider: CatalogProvider,
): ModelsDevEntry {
  const input = model.modalities?.input ?? [];
  return {
    contextLength: positive(model.limit?.context),
    maxCompletionTokens: positive(model.limit?.output),
    inputModalities: input.length ? input : undefined,
    outputModalities: model.modalities?.output?.length
      ? model.modalities.output
      : undefined,
    supportsTools: model.tool_call,
    supportsStructuredOutput: model.structured_output,
    supportsReasoning: model.reasoning,
    supportsVision: input.length ? input.includes("image") : model.attachment,
    promptPrice: perToken(model.cost?.input),
    completionPrice: perToken(model.cost?.output),
    cachedInputPrice: perToken(model.cost?.cache_read),
    family: model.family,
    description: model.description,
    knowledgeCutoff: model.knowledge,
    releaseDate: model.release_date,
    lastUpdated: model.last_updated,
    openWeights: model.open_weights,
    catalogUrl: provider.doc,
  };
}

function lookup(
  scopes: Array<Map<string, ModelsDevEntry>>,
  modelId: string,
): ModelsDevEntry | undefined {
  for (const key of indexKeys(modelId))
    for (const scope of scopes) {
      const entry = scope.get(key);
      if (entry) return entry;
    }
  return undefined;
}

function indexKeys(modelId: string): string[] {
  const base = modelId.trim().toLowerCase();
  if (!base) return [];
  const exact: string[] = [];
  const loose: string[] = [];
  const push = (value: string) => {
    if (!value) return;
    exact.push(value, value.replace(/:/g, "-"));
    const slash = value.lastIndexOf("/");
    if (slash >= 0) exact.push(value.slice(slash + 1).replace(/:/g, "-"));
    for (const variant of [value, value.slice(slash + 1)])
      loose.push(signature(variant));
  };
  push(base);
  push(base.replace(/:(free|nitro|extended|online|beta|floor)$/u, ""));
  const tag = base.indexOf(":");
  if (tag > 0) push(base.slice(0, tag));
  return [...new Set([...exact, ...loose])].filter(Boolean);
}

const NOISE_TOKENS = new Set([
  "instruct",
  "it",
  "hf",
  "chat",
  "latest",
  "gguf",
  "fp16",
  "bf16",
  "f16",
  "f32",
]);

function signature(value: string): string {
  return value
    .replace(/^@[^/]+\//u, "")
    .replace(/[:_]/g, "-")
    .replace(/([a-z])(\d)/gu, "$1-$2")
    .split("-")
    .filter(
      (token) => token && !NOISE_TOKENS.has(token) && !/^q\d/u.test(token),
    )
    .join("-");
}

function positive(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function perToken(value: number | undefined): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return undefined;
  return String(value / 1_000_000);
}
