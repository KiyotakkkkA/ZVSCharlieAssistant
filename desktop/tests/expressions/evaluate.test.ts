import { describe, expect, it } from "vitest";
import {
  ExpressionRuntimeError,
  ExpressionSyntaxError,
  evaluateExpression,
} from "../../src/shared/expressions";

const run = (source: string, scope: Record<string, unknown> = {}) =>
  evaluateExpression(source, scope);

describe("литералы и арифметика", () => {
  it("считает числа и приоритет операторов", () => {
    expect(run("2 + 3 * 4")).toBe(14);
    expect(run("(2 + 3) * 4")).toBe(20);
    expect(run("7 % 3")).toBe(1);
    expect(run("-5 + 2")).toBe(-3);
    expect(run("1.5e2")).toBe(150);
  });

  it("разбирает строки с экранированием", () => {
    expect(run('"a\\nb"')).toBe("a\nb");
    expect(run("'кавычка: \\''")).toBe("кавычка: '");
    expect(run('"\\u0041"')).toBe("A");
  });

  it("конкатенирует, если хотя бы один операнд строка", () => {
    expect(run('"n=" + 5')).toBe("n=5");
    expect(run('5 + "1"')).toBe("51");
    expect(run("5 + 1")).toBe(6);
  });

  it("понимает литералы коллекций", () => {
    expect(run("[1, 2, 3]")).toEqual([1, 2, 3]);
    expect(run("{ a: 1, 'b-c': 2 }")).toEqual({ a: 1, "b-c": 2 });
    expect(run("[1, 2, 3,]")).toEqual([1, 2, 3]);
  });
});

describe("логика и сравнения", () => {
  it("поддерживает короткое замыкание", () => {
    expect(run("false && $missing")).toBe(false);
    expect(run("true || $missing")).toBe(true);
    expect(run("null ?? 'запасное'")).toBe("запасное");
    expect(run("0 ?? 'запасное'")).toBe(0);
  });

  it("сравнивает объекты по значению, а не по ссылке", () => {
    expect(run("{ a: 1 } === { a: 1 }")).toBe(true);
    expect(run("[1, 2] === [1, 2]")).toBe(true);
    expect(run("{ a: 1 } === { a: 2 }")).toBe(false);
  });

  it("сравнивает числовые строки численно", () => {
    expect(run('"10" > "9"')).toBe(true);
    expect(run('"10" == 10')).toBe(true);
    expect(run('"10" === 10')).toBe(false);
  });

  it("вычисляет тернарный оператор", () => {
    expect(run("1 > 2 ? 'да' : 'нет'")).toBe("нет");
  });
});

describe("контекст", () => {
  const scope = {
    $json: {
      name: "Отчёт",
      size: 42,
      tags: ["a", "b"],
      nested: { deep: { value: 7 } },
    },
    $index: 3,
    $node: { "Агент Аналитик": { json: { text: "готово" } } },
    $trigger: { entity: { subject: "Тема письма" } },
  };

  it("читает переменные и вложенные пути", () => {
    expect(run("$json.name", scope)).toBe("Отчёт");
    expect(run("$json.nested.deep.value", scope)).toBe(7);
    expect(run("$json.tags[1]", scope)).toBe("b");
    expect(run("$json.tags[-1]", scope)).toBe("b");
    expect(run("$index", scope)).toBe(3);
  });

  it("читает узлы по отображаемому имени", () => {
    expect(run('$node["Агент Аналитик"].json.text', scope)).toBe("готово");
    expect(run("$trigger.entity.subject", scope)).toBe("Тема письма");
  });

  it("поддерживает опциональную цепочку", () => {
    expect(run("$json.missing?.deep", scope)).toBeUndefined();
    expect(run("$json.nested?.deep?.value", scope)).toBe(7);
  });

  it("падает на неизвестной переменной", () => {
    expect(() => run("$unknownVariable")).toThrow(ExpressionRuntimeError);
  });

  it("падает на голом идентификаторе без $", () => {
    expect(() => run("name")).toThrow(ExpressionRuntimeError);
  });
});

describe("методы значений", () => {
  const scope = {
    $json: { text: "  Привет Мир  ", items: [3, 1, 2], user: { a: 1, b: 2 } },
  };

  it("методы строк", () => {
    expect(run("$json.text.trim().toUpperCase()", scope)).toBe("ПРИВЕТ МИР");
    expect(run("$json.text.trim().split(' ')", scope)).toEqual([
      "Привет",
      "Мир",
    ]);
    expect(run("'abc'.length", scope)).toBe(3);
    expect(run("'a,b'.replaceAll(',', ';')", scope)).toBe("a;b");
    expect(run("'42'.toNumber()", scope)).toBe(42);
  });

  it("методы массивов со стрелками", () => {
    expect(run("$json.items.map(x => x * 2)", scope)).toEqual([6, 2, 4]);
    expect(run("$json.items.filter(x => x > 1)", scope)).toEqual([3, 2]);
    expect(run("$json.items.sort()", scope)).toEqual([1, 2, 3]);
    expect(run("$json.items.sum()", scope)).toBe(6);
    expect(run("$json.items.reduce((acc, x) => acc + x, 100)", scope)).toBe(
      106,
    );
    expect(run("$json.items.length", scope)).toBe(3);
  });

  it("методы объектов", () => {
    expect(run("$json.user.keys()", scope)).toEqual(["a", "b"]);
    expect(run("$json.user.get('a')", scope)).toBe(1);
    expect(run("$json.user.get('zzz', 'нет')", scope)).toBe("нет");
    expect(run("$json.user.pick('a')", scope)).toEqual({ a: 1 });
    expect(run("$json.user.omit('a')", scope)).toEqual({ b: 2 });
  });

  it("данные приоритетнее методов при совпадении имён", () => {
    expect(run("$json.length", { $json: { length: 99 } })).toBe(99);
  });

  it("группировка и сортировка по полю", () => {
    const rows = {
      $json: [
        { city: "Москва", n: 2 },
        { city: "Казань", n: 1 },
        { city: "Москва", n: 3 },
      ],
    };
    expect(run("$json.groupBy('city').keys()", rows)).toEqual([
      "Москва",
      "Казань",
    ]);
    expect(run("$json.sortBy('n').pluck('n')", rows)).toEqual([1, 2, 3]);
  });
});

describe("глобальные функции", () => {
  it("условные и проверки пустоты", () => {
    expect(run("$if(1 > 0, 'да', 'нет')")).toBe("да");
    expect(run("$isEmpty('')")).toBe(true);
    expect(run("$isEmpty('  ')")).toBe(true);
    expect(run("$isEmpty([])")).toBe(true);
    expect(run("$isEmpty({})")).toBe(true);
    expect(run("$isEmpty(0)")).toBe(false);
    expect(run("$default('', 'запасное')")).toBe("запасное");
  });

  it("работа с JSON и путями", () => {
    expect(run("$parseJson('{\"a\":1}').a")).toBe(1);
    expect(run("$stringify({ a: 1 })")).toBe('{"a":1}');
    expect(run("$get({ a: { b: [10, 20] } }, 'a.b.1')")).toBe(20);
    expect(run("$get({}, 'nope', 'зап')")).toBe("зап");
  });

  it("числа и строки", () => {
    expect(run("$round(3.14159, 2)")).toBe(3.14);
    expect(run("$toNumber('3,5')")).toBe(3.5);
    expect(run("$sum([1, 2, 3])")).toBe(6);
    expect(run("$max(1, 9, 5)")).toBe(9);
    expect(run("$slug('Привет Мир!')")).toBe("привет-мир");
  });

  it("даты", () => {
    expect(run("$formatDate('2026-03-05T10:20:30Z', 'YYYY')")).toBe("2026");
    expect(run("$diffDays('2026-03-05', '2026-03-01')")).toBe(4);
    expect(typeof run("$now()")).toBe("string");
  });

  it("base64 и url", () => {
    expect(run("$base64Decode($base64Encode('тест'))")).toBe("тест");
    expect(run("$encodeUrl('a b')")).toBe("a%20b");
  });
});

describe("безопасность песочницы", () => {
  it("не даёт доступ к прототипам", () => {
    expect(run("$json.__proto__", { $json: {} })).toBeUndefined();
    expect(run("$json.constructor", { $json: {} })).toBeUndefined();
    expect(run("'x'.constructor", {})).toBeUndefined();
    expect(run("$json.prototype", { $json: {} })).toBeUndefined();
  });

  it("не даёт call/apply/bind", () => {
    expect(run("$json.toJson.call", { $json: { a: 1 } })).toBeUndefined();
    expect(() => run("$json.toJson.apply()", { $json: { a: 1 } })).toThrow(
      ExpressionRuntimeError,
    );
  });

  it("не пропускает загрязнение прототипа через литерал объекта", () => {
    const result = run("{ __proto__: 1, a: 2 }") as Record<string, unknown>;
    expect(result).toEqual({ a: 2 });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  it("не знает про require, process и globalThis", () => {
    for (const source of [
      "require",
      "process",
      "globalThis",
      "eval",
      "Function",
    ])
      expect(() => run(source)).toThrow(ExpressionRuntimeError);
  });

  it("отсутствуют опасные конструкции на уровне грамматики", () => {
    for (const source of [
      "a = 1",
      "new Date()",
      "typeof 1",
      "delete a.b",
      "1, 2",
    ])
      expect(() => run(source)).toThrow();
  });

  it("прерывает слишком долгие вычисления", () => {
    const wide = { $json: Array.from({ length: 100 }, (_, index) => index) };
    expect(() =>
      run("$json.map(a => $json.map(b => $json.map(c => a + b + c)))", wide),
    ).toThrow(ExpressionRuntimeError);
  });

  it("ограничивает глубину вложенности", () => {
    expect(() => run("(".repeat(80) + "1" + ")".repeat(80))).toThrow(
      ExpressionSyntaxError,
    );
  });

  it("падает на незакрытой строке и мусоре", () => {
    expect(() => run('"незакрыто')).toThrow(ExpressionSyntaxError);
    expect(() => run("1 +")).toThrow(ExpressionSyntaxError);
    expect(() => run("@")).toThrow(ExpressionSyntaxError);
  });
});
