export type ZvsIdConnectionStatus =
  "disconnected" | "connecting" | "connected" | "expired";

export interface ZvsIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
}

export type ZvsIdClientSource = "env" | "server" | "cache" | "none";

export interface ZvsIdConnection {
  status: ZvsIdConnectionStatus;
  identity: ZvsIdentity | null;
  scopes: string[];
  connectedAt: string | null;
  accessTokenExpiresAt: string | null;
  issuer: string;
  clientConfigured: boolean;
  clientSource: ZvsIdClientSource;
  encryptedAtRest: boolean;
}
