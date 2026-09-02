import type { ZvsIdConnection } from "../../../shared/models/zvs-id";
import type { ZvsIdConfig } from "../../infrastructure/zvs-id/zvs-id.config";
import type {
  ClientIdSource,
  ZvsIdClientResolver,
} from "../../infrastructure/zvs-id/zvs-id-client.resolver";
import type {
  LoopbackCallbackServer,
  LoopbackListener,
} from "../../infrastructure/zvs-id/loopback-callback.server";
import type {
  TokenSet,
  UserInfo,
  ZvsIdOAuthClient,
} from "../../infrastructure/zvs-id/zvs-id-oauth.client";
import type {
  StoredConnection,
  ZvsIdConnectionStore,
} from "../../infrastructure/zvs-id/zvs-id-connection.store";

export type OpenExternalUrl = (url: string) => Promise<void>;

export class ZvsIdService {
  private connecting: Promise<ZvsIdConnection> | null = null;
  private activeListener: LoopbackListener | null = null;
  private listeners = new Set<(connection: ZvsIdConnection) => void>();

  private active: ZvsIdConfig;
  private source: ClientIdSource;

  constructor(
    private readonly resolver: ZvsIdClientResolver,
    private readonly oauth: ZvsIdOAuthClient,
    private readonly loopback: LoopbackCallbackServer,
    private readonly store: ZvsIdConnectionStore,
    private readonly openExternal: OpenExternalUrl,
  ) {
    const initial = this.resolver.current();
    this.active = initial.config;
    this.source = initial.source;
  }

  config(): ZvsIdConfig {
    return this.active;
  }

  async refreshClient(): Promise<void> {
    try {
      const resolved = await this.resolver.resolve();
      this.active = resolved.config;
      this.source = resolved.source;
      this.publish();
    } catch {
      return;
    }
  }

  onChange(listener: (connection: ZvsIdConnection) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  status(): ZvsIdConnection {
    if (this.connecting) return this.describe(null, "connecting");
    return this.describe(this.store.read());
  }

  async connect(): Promise<ZvsIdConnection> {
    if (this.connecting) return this.connecting;

    if (!this.active.clientId) {
      const resolved = await this.resolver.resolve();
      this.active = resolved.config;
      this.source = resolved.source;
    }
    if (!this.active.clientId) {
      throw new Error(
        "ZVS ID не выдал client_id для этого приложения — проверьте настройки на сервере",
      );
    }

    this.connecting = this.runConnect().finally(() => {
      this.connecting = null;
      this.activeListener = null;
    });
    this.publish();
    return this.connecting;
  }

  cancelConnect(): void {
    this.activeListener?.close();
  }

  async disconnect(): Promise<ZvsIdConnection> {
    const stored = this.store.read();
    this.cancelConnect();
    this.store.clear();

    if (stored?.refreshToken) {
      await this.oauth.revoke(stored.refreshToken).catch(() => undefined);
    }

    const connection = this.describe(null);
    this.publish();
    return connection;
  }

  async accessToken(): Promise<string | null> {
    const stored = this.store.read();
    if (!stored) return null;
    if (stored.accessTokenExpiresAt > Date.now()) return stored.accessToken;
    if (!stored.refreshToken) return null;

    try {
      const tokens = await this.oauth.refresh(stored.refreshToken);
      this.store.write({
        ...stored,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.expiresAt,
        refreshToken: tokens.refreshToken ?? stored.refreshToken,
        scopes: tokens.scopes,
      });
      this.publish();
      return tokens.accessToken;
    } catch {
      this.publish();
      return null;
    }
  }

  private async runConnect(): Promise<ZvsIdConnection> {
    const listener = await this.loopback.listen();
    this.activeListener = listener;

    try {
      const pkce = this.oauth.createPkce();
      const state = this.oauth.createState();

      await this.openExternal(
        this.oauth.buildAuthorizeUrl({
          redirectUri: listener.redirectUri,
          state,
          challenge: pkce.challenge,
        }),
      );

      const callback = await listener.waitForCallback();
      if (!this.oauth.matchesState(state, callback.state)) {
        throw new Error(
          "Ответ ZVS ID не совпал с запросом — вход отклонён из соображений безопасности",
        );
      }

      const tokens = await this.oauth.exchangeCode({
        code: callback.code,
        verifier: pkce.verifier,
        redirectUri: listener.redirectUri,
      });

      const profile = await this.oauth.fetchUserInfo(tokens.accessToken);
      const stored = this.toStoredConnection(tokens, profile);
      this.store.write(stored);

      const connection = this.describe(stored);
      this.publish();
      return connection;
    } catch (error) {
      this.publish();
      throw error;
    } finally {
      listener.close();
    }
  }

  private toStoredConnection(
    tokens: TokenSet,
    profile: UserInfo,
  ): StoredConnection {
    return {
      identity: {
        subject: profile.sub,
        email: profile.email ?? null,
        emailVerified: profile.email_verified === true,
        displayName: profile.name ?? profile.preferred_username ?? null,
      },
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      connectedAt: new Date().toISOString(),
      issuer: this.active.issuer,
    };
  }

  private describe(
    stored: StoredConnection | null,
    override?: ZvsIdConnection["status"],
  ): ZvsIdConnection {
    const base = {
      issuer: this.active.issuer,
      clientConfigured: this.active.clientId.length > 0,
      clientSource: this.source,
      encryptedAtRest: this.store.isEncryptionAvailable(),
    };

    if (!stored) {
      return {
        ...base,
        status: override ?? "disconnected",
        identity: null,
        scopes: [],
        connectedAt: null,
        accessTokenExpiresAt: null,
      };
    }

    const expired =
      stored.accessTokenExpiresAt <= Date.now() && !stored.refreshToken;

    return {
      ...base,
      status: override ?? (expired ? "expired" : "connected"),
      identity: stored.identity,
      scopes: stored.scopes,
      connectedAt: stored.connectedAt,
      accessTokenExpiresAt: new Date(stored.accessTokenExpiresAt).toISOString(),
    };
  }

  private publish(): void {
    const connection = this.status();
    for (const listener of this.listeners) listener(connection);
  }
}
