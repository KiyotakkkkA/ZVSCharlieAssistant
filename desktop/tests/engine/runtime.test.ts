import { beforeEach, describe, expect, it } from "vitest";
import { edge, graph, node, resetIds } from "../support/graph-builder";
import {
  MemoryPersistence,
  runGraph,
  spyExecutor,
} from "../support/runtime-harness";
import {
  CancelledError,
  ScenarioSuspended,
} from "../../src/shared/scenario/errors";
import type { NodeExecutor } from "../../src/shared/scenario/node-descriptor";

beforeEach(() => resetIds());

const condition = (left: string, operator: string, right = "") => ({
  combinator: "and",
  conditions: [{ left, operator, right, caseSensitive: false }],
});

describe("линейное исполнение", () => {
  it("проводит данные через цепочку узлов", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const set = node("set", {
      name: "Поля",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [
          { name: "greeting", value: "привет {{ $json.who }}", type: "auto" },
        ],
      },
    });
    const output = node("output", { name: "Итог" });

    const result = await runGraph(
      graph(
        [trigger, set, output],
        [edge(trigger, set), edge(set, output)],
        {},
      ),
      {
        input: { who: "мир" },
        extraExecutors: [spyExecutor("output", ({ items }) => items)],
      },
    );

    expect(result.status).toBe("completed");
    expect(
      (result.outputs.Поля as { json: Record<string, unknown> }).json,
    ).toEqual({ greeting: "привет мир" });
  });

  it("режим each исполняет узел для каждого item", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const split = node("splitOut", {
      name: "Развернуть",
      config: { field: "rows", keepParentFields: false, targetField: "value" },
    });
    const each = node("set", {
      name: "Каждому",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [
          { name: "doubled", value: "{{ $json.value * 2 }}", type: "number" },
        ],
      },
    });
    const output = node("output", { name: "Итог" });

    const result = await runGraph(
      graph(
        [trigger, split, each, output],
        [edge(trigger, split), edge(split, each), edge(each, output)],
      ),
      {
        input: { rows: [1, 2, 3] },
        extraExecutors: [spyExecutor("output", ({ items }) => items)],
      },
    );

    expect((result.outputs.Каждому as { items: unknown[] }).items).toEqual([
      { doubled: 2 },
      { doubled: 4 },
      { doubled: 6 },
    ]);
    expect(result.persistence.countFor(each.id)).toBe(1);
  });
});

describe("ветвление", () => {
  const buildBranching = () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const branch = node("if", {
      name: "Проверка",
      config: condition("{{ $json.n }}", "gt", "5"),
    });
    const yes = node("noop", { name: "Да" });
    const no = node("noop", { name: "Нет" });
    const yesOut = node("output", { name: "Итог да" });
    const noOut = node("output", { name: "Итог нет" });
    return {
      nodes: { trigger, branch, yes, no, yesOut, noOut },
      graph: graph(
        [trigger, branch, yes, no, yesOut, noOut],
        [
          edge(trigger, branch),
          edge(branch, yes, { from: "true" }),
          edge(branch, no, { from: "false" }),
          edge(yes, yesOut),
          edge(no, noOut),
        ],
      ),
    };
  };

  it("исполняет только выбранную ветку", async () => {
    const { graph: built, nodes } = buildBranching();
    const result = await runGraph(built, {
      input: { n: 10 },
      extraExecutors: [spyExecutor("output", ({ items }) => items)],
    });

    expect(result.persistence.countFor(nodes.yes.id)).toBe(1);
    expect(result.persistence.countFor(nodes.no.id)).toBe(0);
    expect(result.persistence.countFor(nodes.noOut.id)).toBe(0);
  });

  it("непройденная ветка помечается пропущенной каскадом", async () => {
    const { graph: built, nodes } = buildBranching();
    const result = await runGraph(built, {
      input: { n: 1 },
      extraExecutors: [spyExecutor("output", ({ items }) => items)],
    });

    const skipped = result.events
      .filter((event) => event.type === "node.skipped")
      .map((event) => event.nodeId);
    expect(skipped).toContain(nodes.yes.id);
    expect(skipped).toContain(nodes.yesOut.id);
    expect(result.persistence.countFor(nodes.no.id)).toBe(1);
  });

  it("переключатель разводит items по нескольким веткам", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const split = node("splitOut", {
      name: "Развернуть",
      config: { field: "rows", keepParentFields: false, targetField: "v" },
    });
    const branch = node("switch", {
      name: "Разбор",
      config: {
        mode: "rules",
        allMatches: false,
        expression: "",
        fallbackOutput: true,
        rules: [
          { label: "Большие", group: condition("{{ $json.v }}", "gt", "10") },
          { label: "Средние", group: condition("{{ $json.v }}", "gt", "5") },
        ],
      },
    });
    const big = node("output", { name: "Большие" });
    const mid = node("output", { name: "Средние" });
    const rest = node("output", { name: "Остальные" });

    const collector = spyExecutor("output", ({ items }) => items);
    const result = await runGraph(
      graph(
        [trigger, split, branch, big, mid, rest],
        [
          edge(trigger, split),
          edge(split, branch),
          edge(branch, big, { from: "out0" }),
          edge(branch, mid, { from: "out1" }),
          edge(branch, rest, { from: "fallback" }),
        ],
      ),
      { input: { rows: [20, 7, 1] }, extraExecutors: [collector] },
    );

    const byBranch = result.events.find(
      (event) => event.type === "node.completed" && event.nodeId === branch.id,
    )?.diagnostics?.byBranch as Record<string, number>;
    expect(byBranch).toEqual({ out0: 1, out1: 1, fallback: 1 });
  });

  it("слияние собирает обе ветки", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const left = node("set", {
      name: "Слева",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [{ name: "a", value: "1", type: "number" }],
      },
    });
    const right = node("set", {
      name: "Справа",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [{ name: "b", value: "2", type: "number" }],
      },
    });
    const merge = node("merge", {
      name: "Слияние",
      config: {
        mode: "append",
        inputCount: 2,
        joinKey: "",
        joinType: "inner",
        waitForAll: true,
      },
    });
    const output = node("output", { name: "Итог" });

    const result = await runGraph(
      graph(
        [trigger, left, right, merge, output],
        [
          edge(trigger, left),
          edge(trigger, right),
          edge(left, merge, { to: "in0" }),
          edge(right, merge, { to: "in1" }),
          edge(merge, output),
        ],
      ),
      { extraExecutors: [spyExecutor("output", ({ items }) => items)] },
    );

    expect((result.outputs.Слияние as { items: unknown[] }).items).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
  });
});

describe("циклы", () => {
  it("обрабатывает items батчами и завершается выходом «Готово»", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const split = node("splitOut", {
      name: "Развернуть",
      config: { field: "rows", keepParentFields: false, targetField: "v" },
    });
    const loop = node("loop", {
      name: "Цикл",
      config: { batchSize: 2, maxIterations: 20, reset: false },
    });
    const body = node("set", {
      name: "Тело",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [{ name: "v", value: "{{ $json.v * 10 }}", type: "number" }],
      },
    });
    const output = node("output", { name: "Итог" });

    const result = await runGraph(
      graph(
        [trigger, split, loop, body, output],
        [
          edge(trigger, split),
          edge(split, loop),
          edge(loop, body, { from: "batch" }),
          edge(body, loop),
          edge(loop, output, { from: "done" }),
        ],
      ),
      {
        input: { rows: [1, 2, 3, 4, 5] },
        extraExecutors: [spyExecutor("output", ({ items }) => items)],
      },
    );

    expect(result.status).toBe("completed");
    expect(result.persistence.countFor(loop.id)).toBe(4);
    expect(result.persistence.countFor(body.id)).toBe(3);
    const done =
      result.persistence.runs.filter((run) => run.nodeId === loop.id).at(-1)
        ?.outputs?.done ?? [];
    expect(done.map((item) => (item.json as { v: number }).v)).toEqual([
      10, 20, 30, 40, 50,
    ]);
  });

  it("останавливается по лимиту исполнений узлов", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const split = node("splitOut", {
      name: "Развернуть",
      config: { field: "rows", keepParentFields: false, targetField: "v" },
    });
    const loop = node("loop", {
      name: "Цикл",
      config: { batchSize: 1, maxIterations: 10_000, reset: false },
    });
    const body = node("noop", { name: "Тело" });
    const output = node("output", { name: "Итог" });

    await expect(
      runGraph(
        graph(
          [trigger, split, loop, body, output],
          [
            edge(trigger, split),
            edge(split, loop),
            edge(loop, body, { from: "batch" }),
            edge(body, loop),
            edge(loop, output, { from: "done" }),
          ],
          { maxNodeExecutions: 6 },
        ),
        {
          input: { rows: [1, 2, 3, 4, 5, 6, 7, 8] },
          extraExecutors: [spyExecutor("output", ({ items }) => items)],
        },
      ),
    ).rejects.toThrow(/Превышен лимит/);
  });
});

describe("ошибки, повторы и таймауты", () => {
  it("повторяет узел при временной ошибке и добивается успеха", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const flaky = node("noop", {
      name: "Ненадёжный",
      runtime: {
        retry: {
          maxTries: 3,
          backoffMs: 1,
          backoffFactor: 0,
          maxBackoffMs: 0,
        },
      },
    });
    const output = node("output", { name: "Итог" });

    const executor = spyExecutor("noop", ({ calls, items }) => {
      if (calls < 3)
        throw Object.assign(new Error("временный сбой сети"), {
          code: "ECONNRESET",
        });
      return items;
    });

    const result = await runGraph(
      graph(
        [trigger, flaky, output],
        [edge(trigger, flaky), edge(flaky, output)],
      ),
      {
        extraExecutors: [executor, spyExecutor("output", ({ items }) => items)],
      },
    );

    expect(result.status).toBe("completed");
    expect(result.persistence.statusesFor(flaky.id)).toEqual([
      "failed",
      "failed",
      "completed",
    ]);
  });

  it("не повторяет постоянную ошибку", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const broken = node("noop", {
      name: "Сломанный",
      runtime: {
        retry: { maxTries: 5, backoffMs: 1, backoffFactor: 0, maxBackoffMs: 0 },
      },
    });
    const output = node("output", { name: "Итог" });

    const executor = spyExecutor("noop", () => {
      throw Object.assign(new Error("не найдено"), { status: 404 });
    });

    await expect(
      runGraph(
        graph(
          [trigger, broken, output],
          [edge(trigger, broken), edge(broken, output)],
        ),
        {
          extraExecutors: [
            executor,
            spyExecutor("output", ({ items }) => items),
          ],
        },
      ),
    ).rejects.toThrow(/не найдено/);
    expect(executor.calls).toBe(1);
  });

  it("режим «продолжить» пропускает ошибку дальше по графу", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const broken = node("noop", {
      name: "Сломанный",
      runtime: { onError: "continue" },
    });
    const output = node("output", { name: "Итог" });

    const result = await runGraph(
      graph(
        [trigger, broken, output],
        [edge(trigger, broken), edge(broken, output)],
      ),
      {
        extraExecutors: [
          spyExecutor("noop", () => {
            throw new Error("узел упал");
          }),
          spyExecutor("output", ({ items }) => items),
        ],
      },
    );

    expect(result.status).toBe("completed");
    expect(result.persistence.countFor(output.id)).toBe(1);
  });

  it("сохраняет частичный вывод модели при падении", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const streaming = node("noop", {
      name: "Стриминг",
      runtime: {
        retry: { maxTries: 1, backoffMs: 1, backoffFactor: 0, maxBackoffMs: 0 },
      },
    });
    const output = node("output", { name: "Итог" });

    const executor: NodeExecutor<never, never> = {
      kind: "noop",
      async execute(context: { stream(delta: string): void }) {
        context.stream("начало ответа");
        throw new Error("оборвалось");
      },
    } as unknown as NodeExecutor<never, never>;

    await expect(
      runGraph(
        graph(
          [trigger, streaming, output],
          [edge(trigger, streaming), edge(streaming, output)],
        ),
        {
          extraExecutors: [
            executor,
            spyExecutor("output", ({ items }) => items),
          ],
        },
      ),
    ).rejects.toThrow(/оборвалось/);
  });

  it("прерывает узел по таймауту", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const slow = node("noop", {
      name: "Медленный",
      runtime: {
        timeoutSeconds: 1,
        retry: { maxTries: 1, backoffMs: 1, backoffFactor: 0, maxBackoffMs: 0 },
      },
    });
    const output = node("output", { name: "Итог" });

    const executor: NodeExecutor<never, never> = {
      kind: "noop",
      async execute(context: { signal: AbortSignal }) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 5_000);
          context.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
        return { items: [] };
      },
    } as unknown as NodeExecutor<never, never>;

    await expect(
      runGraph(
        graph(
          [trigger, slow, output],
          [edge(trigger, slow), edge(slow, output)],
        ),
        {
          extraExecutors: [
            executor,
            spyExecutor("output", ({ items }) => items),
          ],
        },
      ),
    ).rejects.toThrow(/не уложился/);
  });
});

describe("приостановка и продолжение", () => {
  it("сохраняет чекпойнт и продолжает ран с того же узла", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const ask = node("noop", { name: "Вопрос" });
    const after = node("set", {
      name: "После",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [{ name: "ok", value: "true", type: "boolean" }],
      },
    });
    const output = node("output", { name: "Итог" });
    const built = graph(
      [trigger, ask, after, output],
      [edge(trigger, ask), edge(ask, after), edge(after, output)],
    );

    let answered = false;
    const asking: NodeExecutor<never, never> = {
      kind: "noop",
      async execute(context: { items: unknown }) {
        if (!answered)
          throw new ScenarioSuspended(
            "019cba09-8f30-7000-8000-000000000304",
            "ask",
          );
        return { items: context.items };
      },
    } as unknown as NodeExecutor<never, never>;

    const persistence = new MemoryPersistence();
    const first = await runGraph(built, {
      extraExecutors: [asking, spyExecutor("output", ({ items }) => items)],
      persistence,
    });

    expect(first.status).toBe("suspended");
    expect(first.suspension).toEqual({
      nodeId: ask.id,
      questionId: "019cba09-8f30-7000-8000-000000000304",
    });
    expect(first.checkpoint).toBeDefined();
    expect(persistence.statusesFor(ask.id)).toEqual(["waiting_for_approval"]);
    expect(persistence.countFor(after.id)).toBe(0);

    answered = true;
    const second = await runGraph(built, {
      extraExecutors: [asking, spyExecutor("output", ({ items }) => items)],
      checkpoint: first.checkpoint,
      persistence,
    });

    expect(second.status).toBe("completed");
    expect(persistence.countFor(after.id)).toBe(1);
    expect(persistence.countFor(output.id)).toBe(1);
  });
});

describe("восстановление после обрыва", () => {
  it("продолжает ран со следующего узла, а не с начала", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const first = node("set", {
      name: "Первый",
      config: {
        keepOnlySet: false,
        remove: [],
        fields: [{ name: "first", value: "true", type: "boolean" }],
      },
    });
    const breaker = node("noop", { name: "Обрыв" });
    const third = node("set", {
      name: "Третий",
      config: {
        keepOnlySet: false,
        remove: [],
        fields: [{ name: "third", value: "true", type: "boolean" }],
      },
    });
    const output = node("output", { name: "Итог" });
    const built = graph(
      [trigger, first, breaker, third, output],
      [
        edge(trigger, first),
        edge(first, breaker),
        edge(breaker, third),
        edge(third, output),
      ],
    );

    const controller = new AbortController();
    let interrupt = true;
    const breaking: NodeExecutor<never, never> = {
      kind: "noop",
      async execute(context: { items: unknown }) {
        if (interrupt) controller.abort();
        return { items: context.items };
      },
    } as unknown as NodeExecutor<never, never>;

    const before = new MemoryPersistence();
    await expect(
      runGraph(built, {
        extraExecutors: [breaking, spyExecutor("output", ({ items }) => items)],
        persistence: before,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(CancelledError);

    expect(before.countFor(first.id)).toBe(1);
    expect(before.countFor(breaker.id)).toBe(1);
    expect(before.countFor(third.id)).toBe(0);

    const checkpoint = before.checkpoints.at(-1);
    expect(checkpoint).toBeDefined();
    expect(checkpoint!.queue).toEqual([third.id]);
    expect(before.clearedExecutionIds).toEqual([]);

    interrupt = false;
    const after = new MemoryPersistence();
    const resumed = await runGraph(built, {
      extraExecutors: [breaking, spyExecutor("output", ({ items }) => items)],
      persistence: after,
      checkpoint,
    });

    expect(resumed.status).toBe("completed");
    expect(after.countFor(first.id)).toBe(0);
    expect(after.countFor(breaker.id)).toBe(0);
    expect(after.countFor(third.id)).toBe(1);
    expect(after.countFor(output.id)).toBe(1);
    expect(after.clearedExecutionIds).toHaveLength(1);
    expect(after.checkpoint).toBeUndefined();
  });
});

describe("выражения в контексте рана", () => {
  it("узел видит выход другого узла по имени", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const first = node("set", {
      name: "Первый",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [{ name: "value", value: "42", type: "number" }],
      },
    });
    const second = node("set", {
      name: "Второй",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [
          {
            name: "copied",
            value: '{{ $node["Первый"].json.value }}',
            type: "number",
          },
        ],
      },
    });
    const output = node("output", { name: "Итог" });

    const result = await runGraph(
      graph(
        [trigger, first, second, output],
        [edge(trigger, first), edge(first, second), edge(second, output)],
      ),
      { extraExecutors: [spyExecutor("output", ({ items }) => items)] },
    );

    expect(
      (result.outputs.Второй as { json: Record<string, unknown> }).json,
    ).toEqual({ copied: 42 });
  });

  it("узел видит переменные сценария и данные триггера", async () => {
    const trigger = node("trigger.manual", { name: "Старт" });
    const set = node("set", {
      name: "Поля",
      config: {
        keepOnlySet: true,
        remove: [],
        fields: [
          { name: "region", value: "{{ $vars.region }}", type: "string" },
          { name: "from", value: "{{ $trigger.who }}", type: "string" },
        ],
      },
    });
    const output = node("output", { name: "Итог" });

    const result = await runGraph(
      graph([trigger, set, output], [edge(trigger, set), edge(set, output)], {
        variables: [{ key: "region", value: "RU", description: "" }],
      }),
      {
        input: { who: "почта" },
        extraExecutors: [spyExecutor("output", ({ items }) => items)],
      },
    );

    expect(
      (result.outputs.Поля as { json: Record<string, unknown> }).json,
    ).toEqual({
      region: "RU",
      from: "почта",
    });
  });
});
