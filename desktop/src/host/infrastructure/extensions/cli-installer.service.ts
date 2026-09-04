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
import {
  cliLaunchPath,
  HOME_ENV_VARIABLE,
} from "../../../shared/bridge/bridge-paths";
import type { CliIntegrationStatus } from "../../../shared/models/extension";

const COMMAND = "zvs";
const SHELL_MARKER = "# zvs-assistant cli";
const SHELL_MARKER_END = "# zvs-assistant cli end";
const POWERSHELL_TIMEOUT_MS = 45_000;
const REGISTRY_TIMEOUT_MS = 5_000;
const USER_ENVIRONMENT_KEY = "HKCU\\Environment";

export class CliInstallerService {
  constructor(
    private readonly userDataPath: string,
    private readonly executablePath: string,
    private readonly entryPath: string,
    private readonly appLaunchArgs: string[] = [],
  ) {}

  get binDir(): string {
    return join(this.userDataPath, "bin");
  }

  get launcherPath(): string {
    return join(
      this.binDir,
      process.platform === "win32" ? `${COMMAND}.cmd` : COMMAND,
    );
  }

  private get powershellLauncherPath(): string {
    return join(this.binDir, `${COMMAND}.ps1`);
  }

  private get launchConfigPath(): string {
    return cliLaunchPath(this.userDataPath);
  }

  status(): CliIntegrationStatus {
    const installed =
      existsSync(this.launcherPath) &&
      (process.platform !== "win32" || existsSync(this.powershellLauncherPath));
    const environment = this.readUserEnvironment();
    const target = normalize(this.binDir);
    return {
      command: COMMAND,
      platform: process.platform,
      binDir: this.binDir,
      launcherPath: this.launcherPath,
      entryPath: this.entryPath,
      entryExists: existsSync(this.entryPath),
      installed,
      onPath: environment.path.some((entry) => normalize(entry) === target),
      shellProfile: process.platform === "win32" ? null : this.shellProfile(),
      home: this.userDataPath,
      homeVariable: HOME_ENV_VARIABLE,
      homeConfigured:
        normalize(environment.home) === normalize(this.userDataPath),
      autoStartConfigured: existsSync(this.launchConfigPath),
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

    this.writeLaunchConfig();

    let error: string | null = null;
    try {
      this.applyEnvironment();
    } catch (cause) {
      error = describeEnvironmentFailure(cause);
    }
    return { ...this.status(), error };
  }

  uninstall(): CliIntegrationStatus {
    rmSync(this.launcherPath, { force: true });
    if (process.platform === "win32")
      rmSync(this.powershellLauncherPath, { force: true });
    rmSync(this.launchConfigPath, { force: true });
    let error: string | null = null;
    try {
      this.clearEnvironment();
    } catch (cause) {
      error = describeEnvironmentFailure(cause);
    }
    return { ...this.status(), error };
  }

  private writeLaunchConfig() {
    writeFileSync(
      this.launchConfigPath,
      `${JSON.stringify(
        {
          executablePath: this.executablePath,
          args: this.appLaunchArgs,
          home: this.userDataPath,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  private launcherScript(): string {
    if (process.platform === "win32")
      return [
        "@echo off",
        "setlocal",
        "chcp 65001 >nul",
        `if "%${HOME_ENV_VARIABLE}%"=="" set ${HOME_ENV_VARIABLE}=${this.userDataPath}`,
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
      `: "\${${HOME_ENV_VARIABLE}:=${this.userDataPath}}"`,
      `export ${HOME_ENV_VARIABLE}`,
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

  private applyEnvironment() {
    if (process.platform === "win32") {
      this.powershell(
        [
          `$bin = ${quote(this.binDir)}`,
          `$zvsHome = ${quote(this.userDataPath)}`,
          "$current = [Environment]::GetEnvironmentVariable('Path','User')",
          "if (-not $current) { $current = '' }",
          "$parts = @($current.Split(';') | Where-Object { $_.Trim() -ne '' })",
          "$known = @($parts | Where-Object { $_.Trim().TrimEnd('\\','/') -ieq $bin.TrimEnd('\\','/') })",
          "if ($known.Count -eq 0) { [Environment]::SetEnvironmentVariable('Path', (($parts + $bin) -join ';'), 'User') }",
          `[Environment]::SetEnvironmentVariable('${HOME_ENV_VARIABLE}', $zvsHome, 'User')`,
        ].join("; "),
      );
      return;
    }

    const profile = this.shellProfile();
    if (!profile) return;
    const current = existsSync(profile) ? readFileSync(profile, "utf8") : "";
    const cleaned = stripShellBlock(current);
    writeFileSync(
      profile,
      `${cleaned}${cleaned.endsWith("\n") || !cleaned ? "" : "\n"}${[
        SHELL_MARKER,
        `export ${HOME_ENV_VARIABLE}="${this.userDataPath}"`,
        `export PATH="$PATH:${this.binDir}"`,
        SHELL_MARKER_END,
        "",
      ].join("\n")}`,
      "utf8",
    );
  }

  private clearEnvironment() {
    if (process.platform === "win32") {
      this.powershell(
        [
          `$bin = ${quote(this.binDir)}`,
          "$current = [Environment]::GetEnvironmentVariable('Path','User')",
          "if ($current) { $parts = @($current.Split(';') | Where-Object { $_.Trim() -ne '' -and $_.Trim().TrimEnd('\\','/') -ine $bin.TrimEnd('\\','/') }); [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User') }",
          `[Environment]::SetEnvironmentVariable('${HOME_ENV_VARIABLE}', $null, 'User')`,
        ].join("; "),
      );
      return;
    }

    const profile = this.shellProfile();
    if (!profile || !existsSync(profile)) return;
    writeFileSync(profile, stripShellBlock(readFileSync(profile, "utf8")));
  }

  private readUserEnvironment(): { path: string[]; home: string } {
    if (process.platform !== "win32")
      return {
        path: (process.env.PATH ?? "").split(delimiter),
        home: this.readProfileHome(),
      };
    return {
      path: (this.readUserRegistryValue("Path") ?? "").split(";"),
      home: this.readUserRegistryValue(HOME_ENV_VARIABLE) ?? "",
    };
  }

  private readUserRegistryValue(name: string): string | undefined {
    try {
      const output = execFileSync(
        "reg.exe",
        ["query", USER_ENVIRONMENT_KEY, "/v", name],
        { encoding: "utf8", timeout: REGISTRY_TIMEOUT_MS, windowsHide: true },
      );
      const match = new RegExp(
        `^\\s*${name}\\s+REG_[A-Z_]+\\s+(.*)$`,
        "im",
      ).exec(output);
      return match?.[1]?.trim();
    } catch {
      return undefined;
    }
  }

  private readProfileHome(): string {
    const profile = this.shellProfile();
    if (!profile || !existsSync(profile)) return "";
    const match = new RegExp(`export ${HOME_ENV_VARIABLE}="([^"]*)"`, "u").exec(
      readFileSync(profile, "utf8"),
    );
    return match?.[1] ?? "";
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

function describeEnvironmentFailure(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  const code = (cause as { code?: unknown } | null)?.code;
  if (code === "ETIMEDOUT" || /ETIMEDOUT/i.test(message))
    return "Windows не ответил на запрос к переменным среды за отведённое время. Повторите включение — обычно со второй попытки проходит.";
  return message;
}

function stripShellBlock(content: string): string {
  const kept: string[] = [];
  let inside = false;
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === SHELL_MARKER) {
      inside = true;
      continue;
    }
    if (inside) {
      if (trimmed === SHELL_MARKER_END) {
        inside = false;
        continue;
      }
      if (trimmed.startsWith("export ")) continue;
      inside = false;
    }
    kept.push(line);
  }
  return kept.join("\n");
}

function normalize(value: string): string {
  const trimmed = value.trim().replace(/[\\/]+$/, "");
  return process.platform === "win32" ? trimmed.toLowerCase() : trimmed;
}

function quote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
