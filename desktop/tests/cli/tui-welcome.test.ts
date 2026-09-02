import { describe, expect, it } from "vitest";
import { LOGO_COLUMNS } from "../../src/cli/tui/atoms/AsciiLogo";
import { welcomeLayout } from "../../src/cli/tui/molecules/WelcomePanel";

describe("раскладка приветствия", () => {
  it("знает настоящую ширину логотипа", () => {
    expect(LOGO_COLUMNS).toBe(25);
  });

  it("рисует логотип, только когда рядом целиком помещается подпись", () => {
    expect(welcomeLayout(53, 24).logo).toBe(true);
    expect(welcomeLayout(52, 24).logo).toBe(false);
  });

  it("убирает логотип на низком терминале, чтобы его не срезало сверху", () => {
    expect(welcomeLayout(120, 20).logo).toBe(true);
    expect(welcomeLayout(120, 19).logo).toBe(false);
  });

  it("показывает недавние сессии только при запасе ширины", () => {
    expect(welcomeLayout(100, 24).sessions).toBe(true);
    expect(welcomeLayout(80, 24).sessions).toBe(false);
    // Без логотипа колонка сессий помещается на заметно более узком экране.
    expect(welcomeLayout(60, 12).sessions).toBe(true);
  });

  it("уступает строки подсказок логотипу на низком терминале", () => {
    expect(welcomeLayout(120, 22).hints).toBe(true);
    expect(welcomeLayout(120, 21).hints).toBe(false);
    expect(welcomeLayout(40, 12).hints).toBe(true);
    expect(welcomeLayout(40, 11).hints).toBe(false);
  });
});
