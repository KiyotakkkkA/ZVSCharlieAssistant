import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, join } from "node:path";
import { homedir } from "node:os";
import type { CliIntegrationStatus } from "../../../shared/models/extension";

const COMMAND = "zvs";
const SHELL_MARKER = "# zvs-assistant cli";
const POWERSHELL_TIMEOUT_MS = 10_000;

export class CliInstallerService {
  constructor(
    private readonly userDataPath: string,
    private readonly executablePath: string,
    private readonly entryPath: string,
  ) {}

  get binDir(): string {
    return join(this.userDataPath, "bin");
  }

  get launcherPath(): string {
    return join(this.binDir, process.platform === "win32" ? `${COMMAND}.cmd` : COMMAND);
  }

  private get powershellLauncherPath(): string {
    return join(this.binDir, `${COMMAND}.ps1`);
  }

  status(): CliIntegrationStatus {
    const installed =
      existsSync(this.launcherPath) &&
      (process.platform !== "win32" ||
        existsSync(this.powershellLauncherPath));
    return {
      command: COMMAND,
      platform: process.platform,
      binDir: this.binDir,
      launcherPath: this.launcherPath,
      entryPath: this.entryPath,
      entryExists: existsSync(this.entryPath),
      installed,
      onPath: this.isOnPath(),
      shellProfile: process.platform === "win32" ? null : this.shellProfile(),
      error: null,
    };
  }

  install(): CliIntegrationStatus {
    if (!existsSync(this.entryPath))
      throw new Error(
        `Сборка CLI не найдена: ${this.entryPath}. Выполните «npm run build» в каталоге desktop.`,
      );

    mkdirSync(this.binDir, { recursive: true });
    writeFileSync(this.launcherPath, this.launcherScript(), {
      encoding: "utf8",
    });
    if (process.platform === "win32")
      writeFileSync(
        this.powershellLauncherPath,
        this.powershellLauncherScript(),
        "utf8",
      );
    else chmodSync(this.launcherPath, 0o755);

    let error: string | null = null;
    try {
      this.addToPath();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    return { ...this.status(), error };
  }

  uninstall(): CliIntegrationStatus {
    rmSync(this.launcherPath, { force: true });
    if (process.platform === "win32")
      rmSync(this.powershellLauncherPath, { force: true });
    let error: string | null = null;
    try {
      this.removeFromPath();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    return { ...this.status(), error };
  }

  private launcherScript(): string {
    if (process.platform === "win32")
      return [
        "@echo off",
        "setlocal",
        "chcp 65001 >nul",
        "where.exe node >nul 2>nul",
        "if not errorlevel 1 (",
        `  node "${this.entryPath}" %*`,
        "  exit /b",
        ")",
        "set ELECTRON_RUN_AS_NODE=1",
        `"${this.executablePath}" "${this.entryPath}" %*`,
        "",
      ].join("\r\n");
    return [
      "#!/bin/sh",
      SHELL_MARKER,
      `ELECTRON_RUN_AS_NODE=1 exec "${this.executablePath}" "${this.entryPath}" "$@"`,
      "",
    ].join("\n");
  }

  private powershellLauncherScript(): string {
    return [
      "\uFEFF$utf8 = [System.Text.UTF8Encoding]::new($false)",
      "[Console]::InputEncoding = $utf8",
      "[Console]::OutputEncoding = $utf8",
      "$OutputEncoding = $utf8",
      `& (Join-Path $PSScriptRoot '${COMMAND}.cmd') @args`,
      "exit $LASTEXITCODE",
      "",
    ].join("\r\n");
  }

  private isOnPath(): boolean {
    const entries =
      process.platform === "win32"
        ? this.readWindowsUserPath()
        : (process.env.PATH ?? "").split(delimiter);
    const target = normalize(this.binDir);
    return entries.some((entry) => normalize(entry) === target);
  }

  private addToPath() {
    if (process.platform === "win32") {
      const entries = this.readWindowsUserPath();
      const target = normalize(this.binDir);
      if (entries.some((entry) => normalize(entry) === target)) return;
      const next = [...entries.filter(Boolean), this.binDir].join(";");
      this.powershell(
        `[Environment]::SetEnvironmentVariable('Path', ${quote(next)}, 'User')`,
      );
      return;
    }

    const profile = this.shellProfile();
    if (!profile) return;
    const current = existsSync(profile) ? readFileSync(profile, "utf8") : "";
    if (current.includes(SHELL_MARKER)) return;
    writeFileSync(
      profile,
      `${current}${current.endsWith("\n") || !current ? "" : "\n"}${SHELL_MARKER}\nexport PATH="$PATH:${this.binDir}"\n`,
      "utf8",
    );
  }

  private removeFromPath() {
    if (process.platform === "win32") {
      const entries = this.readWindowsUserPath();
      const target = normalize(this.binDir);
      const next = entries.filter(
        (entry) => entry && normalize(entry) !== target,
      );
      if (next.length === entries.filter(Boolean).length) return;
      this.powershell(
        `[Environment]::SetEnvironmentVariable('Path', ${quote(next.join(";"))}, 'User')`,
      );
      return;
    }

    const profile = this.shellProfile();
    if (!profile || !existsSync(profile)) return;
    const lines = readFileSync(profile, "utf8").split("\n");
    const kept: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index]?.trim() === SHELL_MARKER) {
        index += 1;
        continue;
      }
      kept.push(lines[index] ?? "");
    }
    writeFileSync(profile, kept.join("\n"), "utf8");
  }

  private readWindowsUserPath(): string[] {
    const raw = this.powershell(
      "[Environment]::GetEnvironmentVariable('Path','User')",
    );
    return raw.split(";");
  }

  private powershell(script: string): string {
    return execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        encoding: "utf8",
        timeout: POWERSHELL_TIMEOUT_MS,
        windowsHide: true,
      },
    ).trim();
  }

  private shellProfile(): string | null {
    const home = homedir();
    const shell = process.env.SHELL ?? "";
    if (shell.includes("zsh")) return join(home, ".zshrc");
    if (shell.includes("bash")) return join(home, ".bashrc");
    return join(home, ".profile");
  }
}

function normalize(value: string): string {
  const trimmed = value.trim().replace(/[\\/]+$/, "");
  return process.platform === "win32" ? trimmed.toLowerCase() : trimmed;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
