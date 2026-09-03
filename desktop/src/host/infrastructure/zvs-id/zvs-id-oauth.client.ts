import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ZvsIdConfig, ZvsIdFetch } from "./zvs-id.config";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: number;
  scopes: string[];
}

export interface UserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
}

interface DiscoveryDocument {
  token_endpoint: string;
  userinfo_endpoint: string;
  revocation_endpoint?: string;
}

const DISCOVERY_TTL_MS = 30 * 60 * 1000;
const EXPIRY_SKEW_MS = 60_000;

export class ZvsIdOAuthClient {
  private discovery?: {
    issuer: string;
    document: DiscoveryDocument;
    expiresAt: number;
  };

  constructor(
    private readonly readConfig: () => ZvsIdConfig,
    private readonly request: ZvsIdFetch = globalThis.fetch,
  ) {}

  private get config(): ZvsIdConfig {
    return this.readConfig();
  }

  createPkce(): PkcePair {
    const verifier = randomBytes(32).toString("base64url");
    return {
      verifier,
      challenge: createHash("sha256").update(verifier).digest("base64url"),
    };
  }

  createState(): string {
    return randomBytes(16).toString("base64url");
  }

  matchesState(expected: string, received: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  buildAuthorizeUrl(input: {
    redirectUri: string;
    state: string;
    challenge: string;
  }): string {
    const url = new URL(this.config.authorizeUrl);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", this.config.scopes.join(" "));
    url.searchParams.set("state", input.state);
    url.searchParams.set("code_challenge", input.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    verifier: string;
    redirectUri: string;
  }): Promise<TokenSet> {
    return this.requestToken({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.verifier,
    });
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return this.requestToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  async fetchUserInfo(accessToken: string): Promise<UserInfo> {
    const { userinfo_endpoint } = await this.resolveDiscovery();
    const response = await this.fetchZvsId(
      userinfo_endpoint,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "получить профиль пользователя",
    );

    if (!response.ok) {
      throw new Error(
        `ZVS ID не вернул профиль пользователя (${response.status})`,
      );
    }

    return (await response.json()) as UserInfo;
  }

  async revoke(token: string): Promise<void> {
    const discovery = await this.resolveDiscovery();
    if (!discovery.revocation_endpoint) return;

    await this.fetchZvsId(
      discovery.revocation_endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token, client_id: this.config.clientId }),
      },
      "завершить сессию",
    );
  }

  private async requestToken(
    params: Record<string, string>,
  ): Promise<TokenSet> {
    const { token_endpoint } = await this.resolveDiscovery();
    const response = await this.fetchZvsId(
      token_endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          ...params,
        }),
      },
      "обменять код авторизации",
    );

    const body = (await response.json().catch(() => null)) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    } | null;

    if (!response.ok || !body?.access_token) {
      throw new Error(describeTokenError(response.status, body));
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      idToken: body.id_token ?? null,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - EXPIRY_SKEW_MS,
      scopes: body.scope ? body.scope.split(" ") : this.config.scopes,
    };
  }

  private async resolveDiscovery(): Promise<DiscoveryDocument> {
    const now = Date.now();
    const issuer = this.config.issuer;
    if (
      this.discovery &&
      this.discovery.issuer === issuer &&
      this.discovery.expiresAt > now
    ) {
      return this.discovery.document;
    }

    const response = await this.fetchZvsId(
      `${issuer}/.well-known/openid-configuration`,
      undefined,
      "загрузить конфигурацию OpenID Connect",
    );
    if (!response.ok) {
      throw new Error(
        `ZVS ID недоступен: не удалось загрузить конфигурацию (${response.status})`,
      );
    }

    const document = (await response.json()) as DiscoveryDocument;
    if (!document.token_endpoint || !document.userinfo_endpoint) {
      throw new Error("ZVS ID вернул неполную конфигурацию OpenID Connect");
    }

    this.discovery = { issuer, document, expiresAt: now + DISCOVERY_TTL_MS };
    return document;
  }

  private async fetchZvsId(
    url: string,
    init: RequestInit | undefined,
    action: string,
  ): Promise<Response> {
    try {
      return await this.request(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(20_000),
      });
    } catch (cause) {
      throw new Error(`ZVS ID недоступен: не удалось ${action}`, { cause });
    }
  }
}

function describeTokenError(
  status: number,
  body: { error?: string; error_description?: string } | null,
): string {
  if (body?.error === "invalid_grant") {
    return "Подключение к ZVS ID истекло — войдите заново";
  }
  if (body?.error === "invalid_client") {
    return "ZVS ID не знает это приложение — проверьте ZVS_ID_CLIENT_ID";
  }
  if (body?.error_description) return body.error_description;
  if (body?.error) return body.error;
  return `ZVS ID отклонил запрос токена (${status})`;
}
