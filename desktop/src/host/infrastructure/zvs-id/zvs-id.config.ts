export interface ZvsIdConfig {
  issuer: string;
  authorizeUrl: string;
  clientId: string;
  scopes: string[];
}

export type ZvsIdFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface ZvsIdBaseConfig extends ZvsIdConfig {
  clientConfigUrl: string;
}

const DEFAULT_ISSUER = "https://id.zvsd.ru";
const DEFAULT_AUTHORIZE_URL = "https://hub.zvsd.ru/oauth/authorize";
const DEFAULT_CLIENT_CONFIG_URL =
  "https://api.zvsd.ru/library/apps/zvs-assistant/oauth-client";
const DEFAULT_SCOPES = ["openid", "profile", "email", "offline_access"];

export function resolveZvsIdConfig(
  env: NodeJS.ProcessEnv = process.env,
): ZvsIdBaseConfig {
  const scopes = (env.ZVS_ID_SCOPES ?? "").trim();

  return {
    issuer: trimTrailingSlash(env.ZVS_ID_ISSUER ?? DEFAULT_ISSUER),
    authorizeUrl: env.ZVS_ID_AUTHORIZE_URL ?? DEFAULT_AUTHORIZE_URL,
    clientConfigUrl: env.ZVS_ID_CLIENT_CONFIG_URL ?? DEFAULT_CLIENT_CONFIG_URL,
    clientId: (env.ZVS_ID_CLIENT_ID ?? "").trim(),
    scopes: scopes ? scopes.split(/\s+/) : DEFAULT_SCOPES,
  };
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
