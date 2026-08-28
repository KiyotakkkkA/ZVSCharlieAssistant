import { execFile } from "node:child_process";

const MAX_OUTPUT_BYTES = 512 * 1024;
const TIMEOUT_MS = 120_000;

export interface ShellCommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export async function runShellCommand(
  command: string,
  cwd: string,
): Promise<ShellCommandResult> {
  const script = command.trim();
  if (!script) throw new Error("Введите команду после !");

  const shell = shellInvocation(script);
  return new Promise((resolve) => {
    execFile(
      shell.executable,
      shell.args,
      {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES,
      },
      (error, stdout, stderr) => {
        const processError = error as NodeJS.ErrnoException & {
          code?: string | number;
          killed?: boolean;
        };
        resolve({
          command: script,
          stdout: stdout.trimEnd(),
          stderr: stderr.trimEnd(),
          exitCode:
            typeof processError?.code === "number"
              ? processError.code
              : error
                ? 1
                : 0,
          timedOut: Boolean(processError?.killed),
        });
      },
    );
  });
}

function shellInvocation(script: string): {
  executable: string;
  args: string[];
} {
  if (process.platform !== "win32")
    return {
      executable: process.env.SHELL || "/bin/sh",
      args: ["-lc", script],
    };

  const utf8Script = [
    "$utf8 = New-Object System.Text.UTF8Encoding $false",
    "[Console]::InputEncoding = $utf8",
    "[Console]::OutputEncoding = $utf8",
    "$OutputEncoding = $utf8",
    "$global:LASTEXITCODE = 0",
    `& { ${script} }`,
    "if (-not $?) { if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } else { exit 1 } }",
    "exit $LASTEXITCODE",
  ].join("; ");
  return {
    executable: "powershell.exe",
    args: [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      utf8Script,
    ],
  };
}

export function formatShellResult(result: ShellCommandResult): string {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const status = result.timedOut
    ? "тайм-аут 120s"
    : `exit ${result.exitCode}`;
  return [`# Shell · ${status}`, "```text", output || "(нет вывода)", "```"].join(
    "\n",
  );
}
