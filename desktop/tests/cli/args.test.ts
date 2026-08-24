import { describe, expect, it } from "vitest";
import { parseArgs } from "../../src/cli/args";

describe("параметр проекта для каталога запуска", () => {
  it.each(["--pd", "--project-dir"])("распознаёт %s как флаг", (flag) => {
    const options = parseArgs([flag]);

    expect(options.projectDirectory).toBe(true);
    expect(options.project).toBeUndefined();
  });

  it("не смешивает выбор каталога с явным идентификатором проекта", () => {
    expect(() => parseArgs(["--pd", "--project", crypto.randomUUID()])).toThrow(
      "Параметры --project и --pd нельзя использовать вместе",
    );
  });
});
