import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ZvsIdClientResolver } from "../../src/host/infrastructure/zvs-id/zvs-id-client.resolver";
import type { ZvsIdBaseConfig } from "../../src/host/infrastructure/zvs-id/zvs-id.config";

let directory: string | undefined;

const BASE: ZvsIdBaseConfig = {
  issuer: "https://id.zvsd.ru",
  authorizeUrl: "https://hub.zvsd.ru/oauth/authorize",
  clientConfigUrl:
    "https://api.zvsd.ru/library/apps/zvs-assistant/oauth-client",
  clientId: "",
  scopes: ["openid", "profile"],
};

const SERVER_PAYLOAD = {
  clientId: "388777246174740485",
  issuer: "https://id.zvsd.ru",
  authorizeUrl: "https://hub.zvsd.ru/oauth/authorize",
  scopes: ["openid", "profile", "email", "offline_access"],
};

afterEach(() => {
  vi.restoreAllMocks();
  if (!directory) return;
  const target = resolve(directory);
  const relativePath = relative(resolve(tmpdir()), target);
  if (
    !relativePath ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Refusing to remove a non-temporary path: ${target}`);
  }
  rmSync(target, { recursive: true, force: true });
  directory = undefined;
});

function cachePath(): string {
  directory = mkdtempSync(join(tmpdir(), "zvs-client-"));
  return join(directory, "zvs-id-client.json");
}

function respondWith(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

describe("ZvsIdClientResolver", () => {
  it("prefers an explicitly configured client id over the server", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const resolver = new ZvsIdClientResolver(
      { ...BASE, clientId: "local-override" },
      cachePath(),
    );

    const resolved = await resolver.resolve();

    expect(resolved.source).toBe("env");
    expect(resolved.config.clientId).toBe("local-override");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches the client id from the server and caches it", async () => {
    respondWith(SERVER_PAYLOAD);
    const path = cachePath();
    const resolver = new ZvsIdClientResolver(BASE, path);

    const resolved = await resolver.resolve();

    expect(resolved.source).toBe("server");
    expect(resolved.config.clientId).toBe(SERVER_PAYLOAD.clientId);
    expect(resolved.config.scopes).toEqual(SERVER_PAYLOAD.scopes);
    expect(JSON.parse(readFileSync(path, "utf8"))).toMatchObject({
      clientId: SERVER_PAYLOAD.clientId,
    });
  });

  it("falls back to the cache when the server is unreachable", async () => {
    const path = cachePath();
    writeFileSync(
      path,
      JSON.stringify({ ...SERVER_PAYLOAD, fetchedAt: "2026-09-02T00:00:00Z" }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const resolved = await new ZvsIdClientResolver(BASE, path).resolve();

    expect(resolved.source).toBe("cache");
    expect(resolved.config.clientId).toBe(SERVER_PAYLOAD.clientId);
  });

  it("surfaces the server message when nothing is cached yet", async () => {
    respondWith({ message: "client_id ещё не задан" }, 503);

    await expect(
      new ZvsIdClientResolver(BASE, cachePath()).resolve(),
    ).rejects.toThrow("client_id ещё не задан");
  });

  it("reports no client id before anything has been resolved", () => {
    const resolver = new ZvsIdClientResolver(BASE, cachePath());

    expect(resolver.current().source).toBe("none");
    expect(resolver.current().config.clientId).toBe("");
  });

  it("keeps the pinned issuer even if the server sends its own", async () => {
    respondWith({
      ...SERVER_PAYLOAD,
      issuer: BASE.issuer,
      authorizeUrl: "https://evil.example/authorize",
    });

    const resolved = await new ZvsIdClientResolver(BASE, cachePath()).resolve();

    expect(resolved.config.authorizeUrl).toBe(BASE.authorizeUrl);
    expect(resolved.config.issuer).toBe(BASE.issuer);
  });

  it("refuses a response that names a different issuer", async () => {
    respondWith({ ...SERVER_PAYLOAD, issuer: "https://evil.example" });

    await expect(
      new ZvsIdClientResolver(BASE, cachePath()).resolve(),
    ).rejects.toThrow("чужой issuer");
  });

  it("shares one in-flight request between concurrent callers", async () => {
    const fetchSpy = vi.fn(
      async () => new Response(JSON.stringify(SERVER_PAYLOAD), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const resolver = new ZvsIdClientResolver(BASE, cachePath());

    await Promise.all([resolver.resolve(), resolver.resolve()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
