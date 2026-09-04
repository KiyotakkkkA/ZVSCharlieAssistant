import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cliLaunchPath } from "../shared/bridge/bridge-paths";

export interface CliLaunchSpec {
  executablePath: string;
  args: string[];
}

export function readLaunchSpec(home: string): CliLaunchSpec | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(cliLaunchPath(home), "utf8"));
  } catch {
    return undefined;
  }
  if (!raw || typeof raw !== "object") return undefined;
  const record = raw as { executablePath?: unknown; args?: unknown };
  if (
    typeof record.executablePath !== "string" ||
    !record.executablePath.trim()
  )
    return undefined;
  return {
    executablePath: record.executablePath,
    args: Array.isArray(record.args)
      ? record.args.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

export function startApplication(spec: CliLaunchSpec): void {
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const child = spawn(spec.executablePath, spec.args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: environment,
  });
  child.unref();
}
