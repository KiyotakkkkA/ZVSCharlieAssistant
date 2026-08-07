import { connect as connectTcp } from "node:net";
import { connect as connectTls } from "node:tls";
import type { SecretStorageRepository } from "../ports/secret-storage.repository";
import type { UpsertIntegrationProfileInput } from "../../../shared/dto";
import type { IntegrationConnectionResult } from "../../../shared/models/integration";
import type { IntegrationDataSource } from "../../infrastructure/database/integration.data-source";

const buildGithubCreds = (
  token: string | null | undefined,
): Record<string, string> => {
  if (token)
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ZVS-Assistant",
    };
  else
    return {
      Accept: "application/vnd.github+json",
      "User-Agent": "ZVS-Assistant",
    };
};

const buildGitlabCreds = (
  token: string | null | undefined,
): Record<string, string> => {
  if (token) {
    return { "PRIVATE-TOKEN": token };
  } else return {};
};

export class IntegrationProfileService {
  constructor(
    private readonly data: IntegrationDataSource,
    private readonly secrets: SecretStorageRepository,
  ) {}

  snapshot() {
    return this.data.snapshot();
  }

  upsert(input: UpsertIntegrationProfileInput) {
    for (const secretId of Object.values(input.secretBindings))
      if (!this.secrets.getSecret(secretId))
        throw new Error("Выбранный секрет не найден");
    return this.data.upsertProfile(input);
  }

  delete(id: number) {
    this.data.deleteProfile(id);
  }

  async test(
    input: UpsertIntegrationProfileInput,
  ): Promise<IntegrationConnectionResult> {
    try {
      const result =
        input.kind === "telegram_bot"
          ? await this.testTelegram(input)
          : input.kind === "email_imap"
            ? await this.testEmail(input)
            : await this.testConnector(input);
      if (input.id)
        this.data.setConnectionResult(
          input.id,
          result.ok,
          result.error,
          result.metadata,
        );
      return result;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось проверить подключение";
      if (input.id) this.data.setConnectionResult(input.id, false, message);
      return { ok: false, error: message };
    }
  }

  private async testTelegram(
    input: UpsertIntegrationProfileInput,
  ): Promise<IntegrationConnectionResult> {
    const secretId = input.secretBindings.botToken;
    const token = secretId
      ? this.secrets.getSecret(secretId)?.content
      : undefined;
    if (!token) throw new Error("Выберите токен Telegram-бота");
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as {
      ok?: boolean;
      result?: {
        id: number;
        username?: string;
        first_name?: string;
        can_join_groups?: boolean;
      };
      description?: string;
    };
    if (!response.ok || !payload.ok)
      throw new Error(
        payload.description ?? `Telegram вернул HTTP ${response.status}`,
      );
    if (!payload.result) throw new Error("Telegram не вернул данные бота");
    const identity = payload.result.username
      ? `@${payload.result.username}`
      : (payload.result.first_name ?? "Telegram bot");
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

  private testEmail(
    input: UpsertIntegrationProfileInput,
  ): Promise<IntegrationConnectionResult> {
    const host = input.config.host;
    const port = input.config.port;
    if (!host || !port) throw new Error("Укажите IMAP host и port");
    if (!input.secretBindings.password)
      throw new Error("Выберите пароль или app password");
    return new Promise((resolve, reject) => {
      const done = (error?: Error) =>
        error
          ? reject(error)
          : resolve({
              ok: true,
              identity: `${input.config.username ?? "email"}@${host}`,
            });
      const socket = input.config.secure
        ? connectTls({ host, port, servername: host }, () => {
            socket.end();
            done();
          })
        : connectTcp({ host, port }, () => {
            socket.end();
            done();
          });
      socket.setTimeout(10_000, () =>
        socket.destroy(new Error("Таймаут подключения к IMAP")),
      );
      socket.once("error", done);
    });
  }

  private async testConnector(
    input: UpsertIntegrationProfileInput,
  ): Promise<IntegrationConnectionResult> {
    const secretId = input.secretBindings.accessToken;
    const token = secretId
      ? this.secrets.getSecret(secretId)?.content
      : undefined;

    const isGitLab = input.kind === "gitlab_connector";
    const repositoryUrl = input.config.repositoryUrl;
    if (!repositoryUrl) throw new Error("Укажите адрес репозитория");
    const repository = new URL(repositoryUrl);
    const repositoryPath = repository.pathname
      .replace(/^\/+|\/+$/g, "")
      .replace(/\.git$/, "");
    const pathParts = repositoryPath.split("/").filter(Boolean);
    if (pathParts.length < 2)
      throw new Error("Укажите полный адрес репозитория");

    const apiUrl = isGitLab
      ? `${repository.origin}/api/v4/projects/${encodeURIComponent(repositoryPath)}`
      : `${
          repository.hostname === "github.com"
            ? "https://api.github.com"
            : `${repository.origin}/api/v3`
        }/repos/${pathParts[0]}/${pathParts[1]}`;
    const response = await fetch(apiUrl, {
      headers: isGitLab ? buildGitlabCreds(token) : buildGithubCreds(token),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as {
      login?: string;
      username?: string;
      name?: string;
      full_name?: string;
      path_with_namespace?: string;
      message?: string;
      error?: string;
      html_url?: string;
      web_url?: string;
      description?: string | null;
      visibility?: string;
      private?: boolean;
      default_branch?: string;
      language?: string | null;
      stargazers_count?: number;
      star_count?: number;
      forks_count?: number;
      open_issues_count?: number;
      updated_at?: string;
      last_activity_at?: string;
    };
    if (!response.ok)
      throw new Error(
        payload.message ??
          payload.error ??
          `${isGitLab ? "GitLab" : "GitHub"} вернул HTTP ${response.status}`,
      );
    const identity =
      payload.full_name ??
      payload.path_with_namespace ??
      payload.login ??
      payload.username ??
      payload.name ??
      (isGitLab ? "GitLab user" : "GitHub user");

    const branchesUrl = isGitLab
      ? `${repository.origin}/api/v4/projects/${encodeURIComponent(repositoryPath)}/repository/branches?per_page=20`
      : `${
          repository.hostname === "github.com"
            ? "https://api.github.com"
            : `${repository.origin}/api/v3`
        }/repos/${pathParts[0]}/${pathParts[1]}/branches?per_page=20`;
    const branchesResponse = await fetch(branchesUrl, {
      headers: isGitLab ? buildGitlabCreds(token) : buildGithubCreds(token),
      signal: AbortSignal.timeout(15_000),
    });
    const branches = branchesResponse.ok
      ? ((await branchesResponse.json()) as Array<{ name?: string }>)
          .map((branch) => branch.name)
          .filter((name): name is string => Boolean(name))
      : [];

    return {
      ok: true,
      identity,
      metadata: {
        identity,
        repository: {
          fullName: identity,
          webUrl: payload.html_url ?? payload.web_url ?? repositoryUrl,
          description: payload.description ?? undefined,
          visibility:
            payload.visibility ?? (payload.private === true ? "private" : "public"),
          defaultBranch: payload.default_branch,
          branches,
          language: payload.language ?? undefined,
          stars: payload.stargazers_count ?? payload.star_count,
          forks: payload.forks_count,
          openIssues: payload.open_issues_count,
          updatedAt: payload.updated_at ?? payload.last_activity_at,
        },
      },
    };
  }
}
