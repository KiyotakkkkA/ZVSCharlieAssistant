import { beforeEach, describe, expect, it } from "vitest";
import { ScenarioCompiler } from "../../src/shared/scenario/compiler";
import { scenarioDescriptors } from "../../src/shared/scenario/descriptors/index";
import { PermanentError } from "../../src/shared/scenario/errors";
import {
  edge,
  errorsOf,
  graph,
  minimalGraph,
  node,
  resetIds,
  warningsOf,
} from "../support/graph-builder";

const compiler = new ScenarioCompiler(scenarioDescriptors);

beforeEach(() => {
  resetIds();
});

describe("базовая валидация", () => {
  it("принимает минимальный корректный сценарий", () => {
    const result = compiler.validate(minimalGraph().graph);
    expect(errorsOf(result.issues)).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("отвергает граф старого формата", () => {
    const result = compiler.validate({
      version: 1,
      nodes: [],
      edges: [],
    } as never);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toMatch(/версии 1/);
  });

  it("требует хотя бы один триггер", () => {
    const only = node("noop", { name: "Один" });
    const result = compiler.validate(graph([only]));
    expect(errorsOf(result.issues)).toContain(
      "В сценарии нет ни одного триггера",
    );
  });

  it("отвергает неизвестный тип узла", () => {
    const result = compiler.validate(
      graph([node("такого.нет", { name: "X" })]),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("Неизвестный тип узла"),
      ),
    ).toBe(true);
  });

  it("требует уникальные имена узлов", () => {
    const a = node("trigger.manual", { name: "Одинаково" });
    const b = node("noop", { name: "Одинаково" });
    const result = compiler.validate(graph([a, b], [edge(a, b)]));
    expect(
      errorsOf(result.issues).some((message) => message.includes("уже занято")),
    ).toBe(true);
  });
});

describe("связи и порты", () => {
  it("отвергает связь на несуществующий порт", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const target = node("noop", { name: "Цель" });
    const result = compiler.validate(
      graph(
        [trigger, target],
        [edge(trigger, target, { from: "такого-порта-нет" })],
      ),
    );
    expect(
      errorsOf(result.issues).some((message) => message.includes("нет выхода")),
    ).toBe(true);
  });

  it("отвергает соединение несовместимых типов данных", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const store = node("knowledgeStore", {
      name: "База",
      config: { vectorStoreId: 1, limit: 8, minScore: 0 },
    });
    const target = node("noop", { name: "Цель" });
    const result = compiler.validate(
      graph(
        [trigger, store, target],
        [
          edge(trigger, target),
          edge(store, target, { from: "knowledge", to: "main" }),
        ],
      ),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("Несовместимые порты"),
      ),
    ).toBe(true);
  });

  it("запрещает петлю на себя", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const self = node("noop", { name: "Сам" });
    const result = compiler.validate(
      graph([trigger, self], [edge(trigger, self), edge(self, self)]),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("сам на себя"),
      ),
    ).toBe(true);
  });

  it("запрещает входящие связи в триггер", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const other = node("trigger.manual", { name: "Второй" });
    const result = compiler.validate(
      graph([trigger, other], [edge(other, trigger)]),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("не может иметь входящих"),
      ),
    ).toBe(true);
  });

  it("запрещает исходящие связи из результата", () => {
    const { graph: base, nodes } = minimalGraph();
    const extra = node("noop", { name: "Лишний" });
    const result = compiler.validate(
      graph(
        [...base.nodes, extra],
        [...base.edges, edge(nodes.output!, extra)],
      ),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("завершает ветку"),
      ),
    ).toBe(true);
  });

  it("требует подключения обязательных входов", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(graph([trigger, output]));
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("не подключён"),
      ),
    ).toBe(true);
  });

  it("не требует подключения необязательного входа базы знаний", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const agent = node("agent", {
      name: "Агент",
      config: { agentId: "019cba09-8f30-7000-8000-000000000201" },
    });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph(
        [trigger, agent, output],
        [edge(trigger, agent), edge(agent, output)],
      ),
    );
    expect(errorsOf(result.issues)).toEqual([]);
  });
});

describe("циклы", () => {
  it("отвергает цикл на узле, который его не поддерживает", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const a = node("noop", { name: "A" });
    const b = node("noop", { name: "B" });
    const result = compiler.validate(
      graph([trigger, a, b], [edge(trigger, a), edge(a, b), edge(b, a)]),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("замыкает цикл"),
      ),
    ).toBe(true);
  });

  it("разрешает цикл, замкнутый на узел «Цикл по батчам»", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const loop = node("loop", {
      name: "Цикл",
      config: { batchSize: 1, maxIterations: 10, reset: false },
    });
    const body = node("noop", { name: "Тело" });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph(
        [trigger, loop, body, output],
        [
          edge(trigger, loop),
          edge(loop, body, { from: "batch" }),
          edge(body, loop),
          edge(loop, output, { from: "done" }),
        ],
      ),
    );
    expect(errorsOf(result.issues)).toEqual([]);
  });

  it("находит цикл даже в отрезанной от триггера части графа", () => {
    const { graph: base } = minimalGraph();
    const a = node("noop", { name: "Изолированный A" });
    const b = node("noop", { name: "Изолированный B" });
    const result = compiler.validate(
      graph([...base.nodes, a, b], [...base.edges, edge(a, b), edge(b, a)]),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("замыкает цикл"),
      ),
    ).toBe(true);
  });
});

describe("достижимость", () => {
  it("предупреждает о недостижимом узле", () => {
    const { graph: base } = minimalGraph();
    const orphan = node("noop", { name: "Сирота" });
    const output = node("output", { name: "Второй итог" });
    const result = compiler.validate(
      graph(
        [...base.nodes, orphan, output],
        [...base.edges, edge(orphan, output)],
      ),
    );
    expect(
      warningsOf(result.issues).some((message) =>
        message.includes("недостижим"),
      ),
    ).toBe(true);
  });

  it("не считает базу знаний недостижимой", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const store = node("knowledgeStore", {
      name: "База",
      config: { vectorStoreId: 3, limit: 8, minScore: 0 },
    });
    const agent = node("agent", {
      name: "Агент",
      config: { agentId: "019cba09-8f30-7000-8000-000000000201" },
    });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph(
        [trigger, store, agent, output],
        [
          edge(trigger, agent),
          edge(store, agent, { from: "knowledge", to: "knowledge" }),
          edge(agent, output),
        ],
      ),
    );
    expect(warningsOf(result.issues)).toEqual([]);
  });
});

describe("конфиги узлов", () => {
  it("сообщает об ошибке в конфиге по пути поля", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const http = node("http", {
      name: "Запрос",
      config: { url: "https://x", method: "ПРЫГ" },
    });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph([trigger, http, output], [edge(trigger, http), edge(http, output)]),
    );
    expect(
      errorsOf(result.issues).some((message) => message.includes("method")),
    ).toBe(true);
  });

  it("не ругается на выражение в числовом поле — тип станет известен в рантайме", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const http = node("http", {
      name: "Запрос",
      config: { url: "https://x", timeoutSeconds: "{{ $json.timeout }}" },
    });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph([trigger, http, output], [edge(trigger, http), edge(http, output)]),
    );
    expect(errorsOf(result.issues)).toEqual([]);
  });

  it("ловит синтаксическую ошибку в выражении", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const set = node("set", {
      name: "Поля",
      config: {
        keepOnlySet: false,
        remove: [],
        fields: [{ name: "a", value: "{{ 1 + }}", type: "auto" }],
      },
    });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph([trigger, set, output], [edge(trigger, set), edge(set, output)]),
    );
    expect(
      errorsOf(result.issues).some((message) => message.includes("Выражение")),
    ).toBe(true);
  });

  it("предупреждает о ссылке на несуществующий узел", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const set = node("set", {
      name: "Поля",
      config: {
        keepOnlySet: false,
        remove: [],
        fields: [
          {
            name: "a",
            value: '{{ $node["Несуществующий"].json.x }}',
            type: "auto",
          },
        ],
      },
    });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph([trigger, set, output], [edge(trigger, set), edge(set, output)]),
    );
    expect(
      warningsOf(result.issues).some((message) =>
        message.includes("Несуществующий"),
      ),
    ).toBe(true);
  });

  it("применяет собственную проверку типа узла", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const orchestrator = node("orchestrator", { name: "Оркестратор" });
    const output = node("output", { name: "Итог" });
    const result = compiler.validate(
      graph(
        [trigger, orchestrator, output],
        [edge(trigger, orchestrator), edge(orchestrator, output)],
      ),
    );
    expect(
      errorsOf(result.issues).some((message) =>
        message.includes("не подключён ни один исполнитель"),
      ),
    ).toBe(true);
  });
});

describe("динамические порты", () => {
  it("число выходов переключателя зависит от числа веток", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const branch = node("switch", {
      name: "Ветвление",
      config: {
        mode: "rules",
        fallbackOutput: true,
        allMatches: false,
        expression: "",
        rules: [
          { label: "Первая", group: { combinator: "and", conditions: [] } },
          { label: "Вторая", group: { combinator: "and", conditions: [] } },
        ],
      },
    });
    const first = node("output", { name: "Итог 1" });
    const second = node("output", { name: "Итог 2" });
    const rest = node("output", { name: "Итог 3" });
    const compiled = compiler.compile(
      graph(
        [trigger, branch, first, second, rest],
        [
          edge(trigger, branch),
          edge(branch, first, { from: "out0" }),
          edge(branch, second, { from: "out1" }),
          edge(branch, rest, { from: "fallback" }),
        ],
      ),
    );
    expect(
      compiled.nodes.get(branch.id)?.outputs.map((port) => port.id),
    ).toEqual(["out0", "out1", "fallback"]);
  });
});

describe("компиляция", () => {
  it("бросает PermanentError на невалидном графе", () => {
    expect(() =>
      compiler.compile(graph([node("noop", { name: "Один" })])),
    ).toThrow(PermanentError);
  });

  it("ошибка компиляции не подлежит повтору", () => {
    try {
      compiler.compile(graph([node("noop", { name: "Один" })]));
      expect.fail?.("ожидалась ошибка");
    } catch (error) {
      expect((error as PermanentError).retryable).toBe(false);
      expect((error as PermanentError).code).toBe("validation");
    }
  });

  it("возвращает топологический порядок и индексы связей", () => {
    const { graph: base, nodes } = minimalGraph();
    const compiled = compiler.compile(base);
    expect(compiled.order).toEqual([
      nodes.trigger!.id,
      nodes.passthrough!.id,
      nodes.output!.id,
    ]);
    expect(compiled.triggers).toEqual([nodes.trigger!.id]);
    expect(compiled.outgoing.get(nodes.trigger!.id)?.get("main")).toHaveLength(
      1,
    );
    expect(compiled.incoming.get(nodes.output!.id)?.get("main")).toHaveLength(
      1,
    );
    expect(compiled.nodeIdByName.get("Середина")).toBe(nodes.passthrough!.id);
  });

  it("сливает политику повторов: узел важнее дескриптора, дескриптор важнее общей", () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const http = node("http", {
      name: "Запрос",
      config: { url: "https://x" },
      runtime: { retry: { maxTries: 7 } },
    });
    const output = node("output", { name: "Итог" });
    const compiled = compiler.compile(
      graph([trigger, http, output], [edge(trigger, http), edge(http, output)]),
    );
    const runtime = compiled.nodes.get(http.id)!.runtime;
    expect(runtime.retry.maxTries).toBe(7);
    expect(runtime.retry.backoffFactor).toBe(2);
    expect(runtime.timeoutSeconds).toBe(120);
    expect(runtime.itemMode).toBe("each");
  });

  it("собирает переменные сценария", () => {
    const { graph: base } = minimalGraph();
    const compiled = compiler.compile(
      graph(base.nodes, base.edges, {
        variables: [{ key: "region", value: "RU", description: "" }],
      }),
    );
    expect(compiled.variables).toEqual({ region: "RU" });
  });
});
