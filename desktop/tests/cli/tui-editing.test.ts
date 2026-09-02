import { describe, expect, it } from "vitest";
import {
  deleteToLineEnd,
  deleteToLineStart,
  deleteWordAfter,
  deleteWordBefore,
  nextWordBoundary,
  offsetFromPoint,
  pointFromOffset,
  previousWordBoundary,
  wrapDraft,
} from "../../src/cli/tui/editing";

describe("перенос текста в поле ввода", () => {
  it("переносит по словам и хранит смещение начала каждой строки", () => {
    const rows = wrapDraft("один два три четыре", 10);
    expect(rows.map((row) => row.text)).toEqual(["один два", "три четыре"]);
    expect(rows.map((row) => row.start)).toEqual([0, 9]);
  });

  it("режет слово, которое длиннее строки", () => {
    const rows = wrapDraft("абвгдеёжзий", 4);
    expect(rows.map((row) => row.text)).toEqual(["абвг", "деёж", "зий"]);
  });

  it("начинает новую строку на каждом переводе строки", () => {
    const rows = wrapDraft("раз\nдва", 20);
    expect(rows).toEqual([
      { text: "раз", start: 0 },
      { text: "два", start: 4 },
    ]);
  });

  it("для пустого текста отдаёт одну пустую строку", () => {
    expect(wrapDraft("", 10)).toEqual([{ text: "", start: 0 }]);
  });
});

describe("курсор и клик по полю ввода", () => {
  const value = "один два три четыре";
  const rows = wrapDraft(value, 10);

  it("переводит строку и колонку клика в позицию в тексте", () => {
    expect(offsetFromPoint(rows, 0, 5)).toBe(5);
    expect(offsetFromPoint(rows, 1, 4)).toBe(13);
  });

  it("прижимает клик за концом строки к её последнему символу", () => {
    expect(offsetFromPoint(rows, 0, 40)).toBe(8);
    expect(offsetFromPoint(rows, 9, 0)).toBe(rows.at(-1)!.start);
  });

  it("возвращает курсор обратно в те же строку и колонку", () => {
    for (const cursor of [0, 3, 8, 9, 15, value.length]) {
      const point = pointFromOffset(rows, cursor);
      expect(offsetFromPoint(rows, point.row, point.column)).toBe(cursor);
    }
  });
});

describe("правка текста как в readline", () => {
  it("удаляет слово перед курсором", () => {
    expect(deleteWordBefore("привет большой мир", 14)).toEqual({
      value: "привет  мир",
      cursor: 7,
    });
  });

  it("удаляет слово после курсора", () => {
    expect(deleteWordAfter("привет большой мир", 7)).toEqual({
      value: "привет  мир",
      cursor: 7,
    });
  });

  it("удаляет до начала и до конца текущей строки", () => {
    expect(deleteToLineStart("раз\nдва три", 8)).toEqual({
      value: "раз\nтри",
      cursor: 4,
    });
    expect(deleteToLineEnd("раз\nдва три", 4)).toEqual({
      value: "раз\n",
      cursor: 4,
    });
  });

  it("двигает курсор по границам слов", () => {
    const value = "one  two_three, four";
    expect(previousWordBoundary(value, value.length)).toBe(16);
    expect(nextWordBoundary(value, 0)).toBe(3);
    expect(nextWordBoundary(value, 3)).toBe(14);
    expect(previousWordBoundary(value, 0)).toBe(0);
    expect(nextWordBoundary(value, value.length)).toBe(value.length);
  });
});
