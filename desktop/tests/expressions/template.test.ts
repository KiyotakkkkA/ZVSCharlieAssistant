import { describe, expect, it, vi } from "vitest";
import {
  ExpressionEvaluationError,
  collectExpressions,
  hasExpression,
  parseTemplate,
  resolveDeep,
  resolveTemplate,
  validateExpressions,
} from "../../src/shared/expressions";

const scope = {
  $json: { name: "Отчёт", count: 3, list: ["a", "b"] },
  $trigger: { entity: { subject: "Тема" } },
};

describe("разбор шаблона", () => {
  it("делит на текст и вставки", () => {
    expect(parseTemplate("Привет, {{ $json.name }}!")).toEqual([
      { kind: "text", value: "Привет, ", start: 0, end: 8 },
      { kind: "expression", value: "$json.name", start: 8, end: 24 },
      { kind: "text", value: "!", start: 24, end: 25 },
    ]);
  });

  it("не ломается на закрывающих скобках внутри строки", () => {
    const segments = parseTemplate('{{ "}}" }}');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ kind: "expression", value: '"}}"' });
  });

  it("экранирование даёт литеральные скобки", () => {
    expect(resolveTemplate("\\{{ не выражение }}", { scope })).toBe(
      "{{ не выражение }}",
    );
  });

  it("незакрытая вставка остаётся текстом", () => {
    expect(resolveTemplate("{{ $json.name", { scope })).toBe("{{ $json.name");
  });

  it("определяет наличие выражений", () => {
    expect(hasExpression("обычный текст")).toBe(false);
    expect(hasExpression("{{ 1 }}")).toBe(true);
  });
});

describe("вычисление шаблона", () => {
  it("одиночная вставка сохраняет тип", () => {
    expect(resolveTemplate("{{ $json.count }}", { scope })).toBe(3);
    expect(resolveTemplate("{{ $json.list }}", { scope })).toEqual(["a", "b"]);
    expect(resolveTemplate("{{ 1 > 0 }}", { scope })).toBe(true);
  });

  it("смешанный шаблон склеивается в строку", () => {
    expect(
      resolveTemplate("Re: {{ $trigger.entity.subject }}", { scope }),
    ).toBe("Re: Тема");
    expect(resolveTemplate("{{ $json.count }} шт.", { scope })).toBe("3 шт.");
  });

  it("строка без вставок возвращается как есть", () => {
    expect(resolveTemplate("просто текст", { scope })).toBe("просто текст");
  });

  it("режим onError управляет поведением", () => {
    expect(() => resolveTemplate("{{ $nope }}", { scope })).toThrow(
      ExpressionEvaluationError,
    );
    expect(resolveTemplate("{{ $nope }}", { scope, onError: "empty" })).toBe(
      "",
    );
    expect(resolveTemplate("{{ $nope }}", { scope, onError: "keep" })).toBe(
      "{{ $nope }}",
    );
  });

  it("сообщает об ошибке через колбэк", () => {
    const onErrorReport = vi.fn();
    resolveTemplate("{{ $nope }}", { scope, onError: "empty", onErrorReport });
    expect(onErrorReport).toHaveBeenCalledTimes(1);
    expect(onErrorReport.mock.calls[0]?.[0]).toBe("$nope");
  });
});

describe("вычисление структуры конфига", () => {
  it("проходит по вложенным объектам и массивам", () => {
    const config = {
      url: "https://api/{{ $json.name }}",
      limit: "{{ $json.count }}",
      headers: [{ key: "X-Count", value: "{{ $json.count }}" }],
      untouched: 42,
      flag: true,
    };
    expect(resolveDeep(config, { scope })).toEqual({
      url: "https://api/Отчёт",
      limit: 3,
      headers: [{ key: "X-Count", value: 3 }],
      untouched: 42,
      flag: true,
    });
  });

  it("не вычисляет ключи объектов", () => {
    expect(resolveDeep({ "{{ 1 }}": "x" }, { scope })).toEqual({
      "{{ 1 }}": "x",
    });
  });

  it("в сообщение об ошибке попадает путь до поля", () => {
    expect(() => resolveDeep({ a: { b: ["{{ $nope }}"] } }, { scope })).toThrow(
      /a\.b\[0\]/,
    );
  });
});

describe("статическая проверка", () => {
  it("собирает выражения с путями", () => {
    expect(collectExpressions({ a: "{{ 1 }}", b: ["{{ 2 }}"] })).toEqual([
      { path: "a", source: "1" },
      { path: "b[0]", source: "2" },
    ]);
  });

  it("находит синтаксические ошибки без вычисления", () => {
    const issues = validateExpressions({
      a: "{{ 1 + }}",
      b: "{{ }}",
      c: "{{ $json.ok }}",
    });
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.path)).toEqual(["a", "b"]);
  });

  it("не считает ошибкой неизвестную переменную — это проверка рантайма", () => {
    expect(validateExpressions({ a: "{{ $unknownAtDesignTime }}" })).toEqual(
      [],
    );
  });
});
