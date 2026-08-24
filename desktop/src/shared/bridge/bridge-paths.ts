import { createHash } from "node:crypto";
import { join } from "node:path";

export const BRIDGE_TOKEN_FILE = "bridge.token";

export function bridgeSocketPath(userDataPath: string): string {
  if (process.platform === "win32") {
    const key = createHash("sha256")
      .update(userDataPath.toLowerCase())
      .digest("hex")
      .slice(0, 16);
    return `\\\\.\\pipe\\zvs-assistant-${key}`;
  }
  return join(userDataPath, "bridge.sock");
}

export function bridgeTokenPath(userDataPath: string): string {
  return join(userDataPath, BRIDGE_TOKEN_FILE);
}

export function defaultUserDataPath(): string {
  const override = process.env.ZVS_HOME?.trim();
  if (override) return override;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  if (process.platform === "win32")
    return join(
      process.env.APPDATA ?? join(home, "AppData", "Roaming"),
      "zvs-desktop",
    );
  if (process.platform === "darwin")
    return join(home, "Library", "Application Support", "zvs-desktop");
  return join(
    process.env.XDG_CONFIG_HOME ?? join(home, ".config"),
    "zvs-desktop",
  );
}
