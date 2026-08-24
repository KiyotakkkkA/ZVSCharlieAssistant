import { describe, expect, it } from "vitest";
import {
  applyUnifiedDiff,
  createUnifiedDiff,
} from "../../src/host/infrastructure/filesystem/diff";

const before = [
  "export function sum(a: number, b: number) {",
  "  return a + b;",
  "}",
  "",
  "export function mul(a: number, b: number) {",
  "  return a * b;",
  "}",
  "",
].join("\n");

describe("unified diff", () => {
  it("построенный дифф применяется обратно к исходнику", () => {
    const after = before.replace("return a + b;", "return a + b + 0;");
    const { diff, stats } = createUnifiedDiff("src/math.ts", before, after);

    expect(stats).toEqual({ added: 1, removed: 1 });
    expect(diff).toContain("@@");
    expect(applyUnifiedDiff(before, diff)).toBe(after);
  });

  it("находит ханк, даже если файл сдвинулся", () => {
    const after = before.replace("return a * b;", "return a * b * 1;");
    const { diff } = createUnifiedDiff("src/math.ts", before, after);
    const shifted = `// добавленный сверху комментарий\n${before}`;

    expect(applyUnifiedDiff(shifted, diff)).toBe(
      `// добавленный сверху комментарий\n${after}`,
    );
  });

  it("отказывается применять патч к несовпадающему содержимому", () => {
    const after = before.replace("return a + b;", "return a - b;");
    const { diff } = createUnifiedDiff("src/math.ts", before, after);

    expect(() => applyUnifiedDiff("совершенно другой файл\n", diff)).toThrow(
      /не совпал/,
    );
  });

  it("сохраняет завершающий перевод строки", () => {
    const after = `${before}export const version = 1;\n`;
    const { diff } = createUnifiedDiff("src/math.ts", before, after);
    expect(applyUnifiedDiff(before, diff)).toBe(after);
  });

  it("не дописывает перевод строки файлу, где его не было", () => {
    const source = "line1\nline2";
    const { diff } = createUnifiedDiff("x.txt", source, "line1\nline2 changed");
    expect(applyUnifiedDiff(source, diff)).toBe("line1\nline2 changed");
  });

  it("применяет несколько ханков за один патч", () => {
    const source = `${Array.from({ length: 40 }, (_, index) => `line ${index}`).join("\n")}\n`;
    const after = source
      .replace("line 5", "line five")
      .replace("line 30", "line thirty");
    const { diff } = createUnifiedDiff("big.txt", source, after);
    expect(applyUnifiedDiff(source, diff)).toBe(after);
  });

  it("строит патч для нового файла", () => {
    const { diff } = createUnifiedDiff("new.txt", "", "первая строка\n");
    expect(applyUnifiedDiff("", diff)).toBe("первая строка\n");
  });
});
