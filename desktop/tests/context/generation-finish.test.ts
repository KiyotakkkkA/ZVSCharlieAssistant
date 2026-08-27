import { describe, expect, it } from "vitest";
import {
  generationLimitKind,
  isMissingFinishReasonError,
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
    expect(generationLimitKind("error", "incomplete_tool_input:fs_write")).toBe(
      "output_limit",
    );
  });

  it("не считает обычную остановку лимитом", () => {
    expect(generationLimitKind("stop", "stop")).toBeUndefined();
  });

  it("распознаёт поток без terminal finish отдельно от сетевых ошибок", () => {
    expect(
      isMissingFinishReasonError(
        new Error("Response stream ended without a finish reason."),
      ),
    ).toBe(true);
    expect(isMissingFinishReasonError(new Error("socket hang up"))).toBe(false);
  });

  it("возвращает понятную ошибку после исчерпания восстановления", () => {
    expect(limitFailureMessage("output_limit")).toContain("лимит ответа");
    expect(limitFailureMessage("context_overflow")).toContain(
      "Контекстное окно",
    );
  });
});
