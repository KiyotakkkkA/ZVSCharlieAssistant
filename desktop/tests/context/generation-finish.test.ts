import { describe, expect, it } from "vitest";
import {
  generationLimitKind,
  limitFailureMessage,
} from "../../src/host/infrastructure/text-generation/generation-finish";

describe("причина завершения генерации", () => {
  it("распознаёт нормализованный лимит вывода", () => {
    expect(generationLimitKind("length", undefined)).toBe("output_limit");
  });

  it("учитывает сырую причину провайдера", () => {
    expect(generationLimitKind("other", "max_output_tokens")).toBe(
      "output_limit",
    );
    expect(generationLimitKind("other", "context_length_exceeded")).toBe(
      "context_overflow",
    );
  });

  it("не считает обычную остановку лимитом", () => {
    expect(generationLimitKind("stop", "stop")).toBeUndefined();
  });

  it("возвращает понятную ошибку после исчерпания восстановления", () => {
    expect(limitFailureMessage("output_limit")).toContain("лимит ответа");
    expect(limitFailureMessage("context_overflow")).toContain(
      "Контекстное окно",
    );
  });
});
