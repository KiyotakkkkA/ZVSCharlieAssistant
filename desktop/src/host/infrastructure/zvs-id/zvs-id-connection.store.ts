import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { safeStorage } from "electron";
import type { ZvsIdentity } from "../../../shared/models/zvs-id";

export interface StoredConnection {
  identity: ZvsIdentity;
  refreshToken: string | null;
  accessToken: string;
  accessTokenExpiresAt: number;
  scopes: string[];
  connectedAt: string;
  issuer: string;
}

const ENCRYPTED_PREFIX = "enc:v1:";

export class ZvsIdConnectionStore {
  constructor(private readonly path: string) {}

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  read(): StoredConnection | null {
    let raw: string;
    try {
      raw = readFileSync(this.path, "utf8");
    } catch {
      return null;
    }

    try {
      const decoded = raw.startsWith(ENCRYPTED_PREFIX)
        ? safeStorage.decryptString(
            Buffer.from(raw.slice(ENCRYPTED_PREFIX.length), "base64"),
          )
        : raw;
      return parseConnection(JSON.parse(decoded) as unknown);
    } catch {
      return null;
    }
  }

  write(connection: StoredConnection): void {
    const serialized = JSON.stringify(connection);
    const payload = safeStorage.isEncryptionAvailable()
      ? ENCRYPTED_PREFIX +
        safeStorage.encryptString(serialized).toString("base64")
      : serialized;

    writeFileSync(this.path, payload, { encoding: "utf8", flush: true });
  }

  clear(): void {
    try {
      rmSync(this.path, { force: true });
    } catch {
      return;
    }
  }
}

function parseConnection(value: unknown): StoredConnection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const identity = record.identity;

  if (
    !identity ||
    typeof identity !== "object" ||
    typeof (identity as ZvsIdentity).subject !== "string" ||
    typeof record.accessToken !== "string" ||
    typeof record.accessTokenExpiresAt !== "number" ||
    typeof record.connectedAt !== "string" ||
    typeof record.issuer !== "string"
  ) {
    return null;
  }

  const stored = identity as Record<string, unknown>;
  return {
    identity: {
      subject: stored.subject as string,
      email: typeof stored.email === "string" ? stored.email : null,
      emailVerified: stored.emailVerified === true,
      displayName:
        typeof stored.displayName === "string" ? stored.displayName : null,
    },
    refreshToken:
      typeof record.refreshToken === "string" ? record.refreshToken : null,
    accessToken: record.accessToken,
    accessTokenExpiresAt: record.accessTokenExpiresAt,
    scopes: Array.isArray(record.scopes)
      ? record.scopes.filter((item): item is string => typeof item === "string")
      : [],
    connectedAt: record.connectedAt,
    issuer: record.issuer,
  };
}
