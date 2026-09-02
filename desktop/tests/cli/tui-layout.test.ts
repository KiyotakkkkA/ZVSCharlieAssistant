import { describe, expect, it } from "vitest";
import { visibleWindow } from "../../src/cli/tui/windowing";
import { fitSummary } from "../../src/cli/tui/organisms/SessionFooter";
import { footerHintFor } from "../../src/cli/tui/organisms/ZvsTui";
import { composerTextWidth } from "../../src/cli/tui/molecules/Composer";

describe("окно видимых строк списка", () => {
  it("не прокручивает список, пока выделение помещается", () => {
    expect(visibleWindow(0, 20, 8)).toEqual({ start: 0, count: 8 });
    expect(visibleWindow(7, 20, 8)).toEqual({ start: 0, count: 8 });
  });

  it("прокручивает так, чтобы выделение осталось последней строкой", () => {
    expect(visibleWindow(8, 20, 8)).toEqual({ start: 1, count: 8 });
    expect(visibleWindow(19, 20, 8)).toEqual({ start: 12, count: 8 });
  });

  it("не выходит за пределы короткого списка", () => {
    expect(visibleWindow(1, 3, 8)).toEqual({ start: 0, count: 3 });
    expect(visibleWindow(0, 0, 8)).toEqual({ start: 0, count: 1 });
  });
});

describe("правая колонка футера", () => {
  it("отбрасывает наименее важные части целиком", () => {
    const parts = ["GPT-5", "ZVS", "…/desktop", "v1.0.0"];
    expect(fitSummary(parts, 80)).toBe("GPT-5 · ZVS · …/desktop · v1.0.0");
    expect(fitSummary(parts, 23)).toBe("GPT-5 · ZVS · …/desktop");
    expect(fitSummary(parts, 22)).toBe("GPT-5 · ZVS");
    expect(fitSummary(parts, 5)).toBe("GPT-5");
  });

  it("обрезает единственную часть, если и она не влезает", () => {
    expect(fitSummary(["очень-длинное-имя"], 6)).toBe("очень-");
  });
});

describe("подсказка под полем ввода", () => {
  const context = {
    exitArmed: false,
    menu: false,
    question: false,
    suggestions: false,
    busy: false,
    draft: false,
  };

  it("предупреждает о выходе прежде всего остального", () => {
    expect(
      footerHintFor({ ...context, exitArmed: true, busy: true }),
    ).toContain("Ctrl+C");
  });

  it("молчит, когда у списка есть собственная подсказка", () => {
    expect(footerHintFor({ ...context, menu: true })).toBeUndefined();
    expect(footerHintFor({ ...context, suggestions: true })).toBeUndefined();
  });

  it("подсказывает по текущему состоянию", () => {
    expect(footerHintFor({ ...context, question: true })).toContain("Enter");
    expect(footerHintFor({ ...context, busy: true })).toContain("Esc");
    expect(footerHintFor({ ...context, draft: true })).toContain("Shift+Enter");
    expect(footerHintFor(context)).toContain("/help");
  });
});

describe("ширина поля ввода", () => {
  it("вычитает рамку, отступы и стрелку приглашения", () => {
    expect(composerTextWidth(80)).toBe(74);
  });

  it("не схлопывается на узком терминале", () => {
    expect(composerTextWidth(10)).toBe(8);
  });
});
