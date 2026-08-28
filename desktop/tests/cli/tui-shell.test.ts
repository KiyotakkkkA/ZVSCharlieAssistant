import { describe, expect, it } from "vitest";
import { formatShellResult, runShellCommand } from "../../src/cli/tui/shell";

describe("shell-команды TUI", () => {
  it("выполняет команду в выбранной рабочей папке", async () => {
    const command = process.platform === "win32"
      ? "[Console]::Write((Get-Location).Path)"
      : "pwd";
    const result = await runShellCommand(command, process.cwd());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(process.cwd());
    expect(formatShellResult(result)).toContain("Shell · exit 0");
  });

  it("возвращает Unicode без повреждения кодировки", async () => {
    const command = process.platform === "win32"
      ? "[Console]::Write('Привет, мир')"
      : "printf 'Привет, мир'";
    const result = await runShellCommand(command, process.cwd());

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("Привет, мир");
  });

  it("поддерживает ls в PowerShell и POSIX shell", async () => {
    const result = await runShellCommand("ls", process.cwd());
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
  });

  it("сохраняет Unicode в потоке ошибок", async () => {
    const command = process.platform === "win32"
      ? "[Console]::Error.Write('Ошибка кодировки'); exit 7"
      : "printf 'Ошибка кодировки' >&2; exit 7";
    const result = await runShellCommand(command, process.cwd());

    expect(result.exitCode).toBe(7);
    expect(result.stderr).toContain("Ошибка кодировки");
  });

  it("отклоняет пустую команду", async () => {
    await expect(runShellCommand("  ", process.cwd())).rejects.toThrow(
      "Введите команду",
    );
  });
});
