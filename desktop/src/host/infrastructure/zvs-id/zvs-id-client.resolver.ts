import { readFileSync, writeFileSync } from "node:fs";
import type { ZvsIdBaseConfig, ZvsIdConfig, ZvsIdFetch } from "./zvs-id.config";

export type ClientIdSource = "env" | "server" | "cache" | "none";

export interface ResolvedClient {
  config: ZvsIdConfig;
  source: ClientIdSource;
}

interface CachedClient {
  clientId: string;
  scopes: string[];
  fetchedAt: string;
}

const REQUEST_TIMEOUT_MS = 8000;

export class ZvsIdClientResolver {
  private cached: CachedClient | null | undefined;
  private inFlight: Promise<ResolvedClient> | null = null;

  constructor(
    private readonly base: ZvsIdBaseConfig,
    private readonly cachePath: string,
    private readonly request: ZvsIdFetch = globalThis.fetch,
  ) {}

  current(): ResolvedClient {
    if (this.base.clientId) {
      return { config: this.fromBase(this.base.clientId), source: "env" };
    }

    const cached = this.readCache();
    if (cached) return { config: this.fromCache(cached), source: "cache" };

    return { config: this.fromBase(""), source: "none" };
  }

  async resolve(): Promise<ResolvedClient> {
    if (this.base.clientId) return this.current();
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchFromServer().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async fetchFromServer(): Promise<ResolvedClient> {
    let response: Response;
    try {
      response = await this.request(this.base.clientConfigUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      const cached = this.readCache();
      if (cached) return { config: this.fromCache(cached), source: "cache" };
      throw new Error(
        "ZVS ID недоступен — не удалось получить параметры приложения",
      );
    }

    if (!response.ok) {
      const cached = this.readCache();
      if (cached) return { config: this.fromCache(cached), source: "cache" };
      throw new Error(await describeFailure(response));
    }

    const payload = (await response.json()) as {
      clientId?: string;
      issuer?: string;
      scopes?: string[];
    };
    if (!payload.clientId) {
      throw new Error("ZVS ID вернул параметры приложения без client_id");
    }
    if (payload.issuer && payload.issuer !== this.base.issuer) {
      throw new Error(
        `ZVS ID назвал чужой issuer (${payload.issuer}) — ожидался ${this.base.issuer}`,
      );
    }

    const fresh: CachedClient = {
      clientId: payload.clientId,
      scopes:
        Array.isArray(payload.scopes) && payload.scopes.length > 0
          ? payload.scopes.filter((item) => typeof item === "string")
          : this.base.scopes,
      fetchedAt: new Date().toISOString(),
    };

    this.writeCache(fresh);
    return { config: this.fromCache(fresh), source: "server" };
  }

  private fromBase(clientId: string): ZvsIdConfig {
    return {
      clientId,
      issuer: this.base.issuer,
      authorizeUrl: this.base.authorizeUrl,
      scopes: this.base.scopes,
    };
  }

  private fromCache(cached: CachedClient): ZvsIdConfig {
    return {
      clientId: cached.clientId,
      issuer: this.base.issuer,
      authorizeUrl: this.base.authorizeUrl,
      scopes: cached.scopes,
    };
  }

  private readCache(): CachedClient | null {
    if (this.cached !== undefined) return this.cached;

    try {
      const parsed = JSON.parse(
        readFileSync(this.cachePath, "utf8"),
      ) as Partial<CachedClient>;

      this.cached =
        typeof parsed.clientId === "string" && parsed.clientId.length > 0
          ? {
              clientId: parsed.clientId,
              scopes: Array.isArray(parsed.scopes)
                ? parsed.scopes.filter(
                    (item): item is string => typeof item === "string",
                  )
                : this.base.scopes,
              fetchedAt:
                typeof parsed.fetchedAt === "string" ? parsed.fetchedAt : "",
            }
          : null;
    } catch {
      this.cached = null;
    }

    return this.cached;
  }

  private writeCache(client: CachedClient): void {
    this.cached = client;
    try {
      writeFileSync(this.cachePath, `${JSON.stringify(client, null, 2)}\n`, {
        encoding: "utf8",
        flush: true,
      });
    } catch {
      return;
    }
  }
}

async function describeFailure(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;

  if (body?.message) return body.message;
  if (response.status === 404) {
    return "ZVS ID не знает такого приложения в библиотеке";
  }
  return `ZVS ID не отдал параметры приложения (${response.status})`;
}
