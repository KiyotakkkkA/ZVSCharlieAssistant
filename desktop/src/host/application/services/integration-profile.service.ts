import { connect as connectTcp } from "node:net";
import { connect as connectTls } from "node:tls";
import type { SecretStorageRepository } from "../ports/secret-storage.repository";
import type { UpsertIntegrationProfileInput } from "../../../shared/dto";
import type { IntegrationConnectionResult } from "../../../shared/models/integration";
import type { IntegrationDataSource } from "../../infrastructure/database/integration.data-source";

export class IntegrationProfileService {
  constructor(
    private readonly data: IntegrationDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}

  snapshot() { return this.data.snapshot(); }

  upsert(input: UpsertIntegrationProfileInput) {
    for (const secretId of Object.values(input.secretBindings))
      if (!this.secrets.getSecret(secretId)) throw new Error("Выбранный секрет не найден");
    return this.data.upsertProfile(input);
  }

  delete(id: number) { this.data.deleteProfile(id); }

  async test(input: UpsertIntegrationProfileInput): Promise<IntegrationConnectionResult> {
    try {
      const result = input.kind === "telegram_bot"
        ? await this.testTelegram(input)
        : await this.testEmail(input);
      if (input.id)
        this.data.setConnectionResult(
          input.id,
          result.ok,
          result.error,
          result.metadata,
        );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось проверить подключение";
      if (input.id) this.data.setConnectionResult(input.id, false, message);
      return { ok: false, error: message };
    }
  }

  private async testTelegram(input: UpsertIntegrationProfileInput): Promise<IntegrationConnectionResult> {
    const secretId = input.secretBindings.botToken;
    const token = secretId ? this.secrets.getSecret(secretId)?.content : undefined;
    if (!token) throw new Error("Выберите токен Telegram-бота");
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json() as {
      ok?: boolean;
      result?: {
        id: number;
        username?: string;
        first_name?: string;
        can_join_groups?: boolean;
      };
      description?: string;
    };
    if (!response.ok || !payload.ok) throw new Error(payload.description ?? `Telegram вернул HTTP ${response.status}`);
    if (!payload.result) throw new Error("Telegram не вернул данные бота");
    const identity = payload.result.username
      ? `@${payload.result.username}`
      : payload.result.first_name ?? "Telegram bot";
    return {
      ok: true,
      identity,
      metadata: {
        identity,
        telegram: {
          id: payload.result.id,
          username: payload.result.username,
          firstName: payload.result.first_name,
          canJoinGroups: payload.result.can_join_groups,
        },
      },
    };
  }

  private testEmail(input: UpsertIntegrationProfileInput): Promise<IntegrationConnectionResult> {
    const host = input.config.host;
    const port = input.config.port;
    if (!host || !port) throw new Error("Укажите IMAP host и port");
    if (!input.secretBindings.password) throw new Error("Выберите пароль или app password");
    return new Promise((resolve, reject) => {
      const done = (error?: Error) => error ? reject(error) : resolve({ ok: true, identity: `${input.config.username ?? "email"}@${host}` });
      const socket = input.config.secure
        ? connectTls({ host, port, servername: host }, () => { socket.end(); done(); })
        : connectTcp({ host, port }, () => { socket.end(); done(); });
      socket.setTimeout(10_000, () => socket.destroy(new Error("Таймаут подключения к IMAP")));
      socket.once("error", done);
    });
  }
}
