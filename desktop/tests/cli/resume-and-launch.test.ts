import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseArgs, CLI_USAGE } from "../../src/cli/args";
import { readLaunchSpec } from "../../src/cli/launch";
import { CLI_LAUNCH_FILE } from "../../src/shared/bridge/bridge-paths";

let directory: string | undefined;

function createHome(): string {
  directory = mkdtempSync(join(tmpdir(), "zvs-launch-"));
  return directory;
}

afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
});

describe("продолжение диалога из командной строки", () => {
  it("принимает --resume как идентификатор диалога", () => {
    const id = crypto.randomUUID();
    const options = parseArgs(["--resume", id]);

    expect(options.command).toBe("chat");
    expect(options.conversation).toBe(id);
  });

  it("ведёт себя так же, как --conversation", () => {
    const id = crypto.randomUUID();

    expect(parseArgs(["--resume", id])).toEqual(
      parseArgs(["--conversation", id]),
    );
  });

  it("требует значение", () => {
    expect(() => parseArgs(["--resume"])).toThrow(
      "Для параметра --resume не указано значение",
    );
  });

  it("упомянут в справке", () => {
    expect(CLI_USAGE.some(([usage]) => usage.includes("--resume"))).toBe(true);
  });
});

describe("автозапуск приложения из CLI", () => {
  it("читает описание запуска из каталога данных", () => {
    const home = createHome();
    writeFileSync(
      join(home, CLI_LAUNCH_FILE),
      JSON.stringify({
        executablePath: "C:/apps/zvs.exe",
        args: ["--background"],
        home,
      }),
      "utf8",
    );

    expect(readLaunchSpec(home)).toEqual({
      executablePath: "C:/apps/zvs.exe",
      args: ["--background"],
    });
  });

  it("молча отказывается, когда описание отсутствует или испорчено", () => {
    const home = createHome();
    expect(readLaunchSpec(home)).toBeUndefined();

    writeFileSync(join(home, CLI_LAUNCH_FILE), "не json", "utf8");
    expect(readLaunchSpec(home)).toBeUndefined();

    writeFileSync(
      join(home, CLI_LAUNCH_FILE),
      JSON.stringify({ args: ["--background"] }),
      "utf8",
    );
    expect(readLaunchSpec(home)).toBeUndefined();
  });

  it("отбрасывает нестроковые аргументы", () => {
    const home = createHome();
    writeFileSync(
      join(home, CLI_LAUNCH_FILE),
      JSON.stringify({
        executablePath: "/opt/zvs/zvs",
        args: ["--background", 42, null],
      }),
      "utf8",
    );

    expect(readLaunchSpec(home)?.args).toEqual(["--background"]);
  });
});
