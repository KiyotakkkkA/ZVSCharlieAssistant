import { resolveDeep, toText } from "../../../../../shared/expressions";
import {
  conditionGroupSchema,
  type ConditionGroup,
} from "../../../../../shared/scenario";
import { PermanentError } from "../../../../../shared/scenario/errors";
import {
  MAIN_PORT,
  concatItems,
  type ScenarioItem,
  type ScenarioItems,
} from "../../../../../shared/scenario/items";
import type {
  NodeExecutionContext,
  NodeExecutor,
  NodeOutput,
} from "../../../../../shared/scenario/node-descriptor";
import { evaluateGroup } from "./conditions";

function groupForItem(
  context: NodeExecutionContext<unknown>,
  index: number,
): ConditionGroup {
  const resolved = resolveDeep(context.rawConfig, {
    scope: context.scope(index),
    onError: "throw",
  });
  const parsed = conditionGroupSchema.safeParse(resolved);
  if (!parsed.success)
    throw new PermanentError(
      `Условия узла «${context.node.name}» некорректны: ${parsed.error.issues[0]?.message ?? ""}`,
      { context: { nodeId: context.node.id } },
    );
  return parsed.data;
}

export const ifExecutor: NodeExecutor<unknown, unknown> = {
  kind: "if",
  async execute(context) {
    const truthy: ScenarioItems = [];
    const falsy: ScenarioItems = [];
    context.items.forEach((item, index) => {
      const matched = evaluateGroup(groupForItem(context, index));
      (matched ? truthy : falsy).push({
        ...item,
        pairedItem: item.pairedItem ?? index,
      });
    });
    return {
      outputs: { true: truthy, false: falsy },
      diagnostics: { matched: truthy.length, unmatched: falsy.length },
    };
  },
};

export const filterExecutor: NodeExecutor<unknown, unknown> = {
  kind: "filter",
  async execute(context) {
    const kept = context.items.filter((_item, index) =>
      evaluateGroup(groupForItem(context, index)),
    );
    return {
      items: kept,
      diagnostics: {
        kept: kept.length,
        dropped: context.items.length - kept.length,
      },
    };
  },
};

interface SwitchConfig {
  mode: "rules" | "expression";
  rules: Array<{ label: string; group: ConditionGroup }>;
  expression: string;
  allMatches: boolean;
  fallbackOutput: boolean;
}

export const switchExecutor: NodeExecutor<SwitchConfig, unknown> = {
  kind: "switch",
  async execute(context) {
    const config = context.config;
    const outputs: Record<string, ScenarioItems> = {};
    const counts: Record<string, number> = {};

    const send = (portId: string, item: ScenarioItem, index: number): void => {
      (outputs[portId] ??= []).push({
        ...item,
        pairedItem: item.pairedItem ?? index,
      });
      counts[portId] = (counts[portId] ?? 0) + 1;
    };

    context.items.forEach((item, index) => {
      const perItem = resolveDeep(context.rawConfig, {
        scope: context.scope(index),
        onError: "throw",
      }) as unknown as SwitchConfig;

      let matched = false;
      if (config.mode === "expression") {
        const value = toText(perItem.expression);
        perItem.rules.forEach((rule, ruleIndex) => {
          if (matched && !config.allMatches) return;
          if (toText(rule.label) === value) {
            send(`out${ruleIndex}`, item, index);
            matched = true;
          }
        });
      } else {
        perItem.rules.forEach((rule, ruleIndex) => {
          if (matched && !config.allMatches) return;
          const group = conditionGroupSchema.safeParse(rule.group);
          if (group.success && evaluateGroup(group.data)) {
            send(`out${ruleIndex}`, item, index);
            matched = true;
          }
        });
      }

      if (!matched && config.fallbackOutput) send("fallback", item, index);
    });

    return { outputs, diagnostics: { byBranch: counts } };
  },
};

interface MergeConfig {
  mode: "append" | "byKey" | "byPosition" | "chooseBranch";
  inputCount: number;
  joinKey: string;
  joinType: "inner" | "left" | "outer";
  waitForAll: boolean;
}

export const mergeExecutor: NodeExecutor<MergeConfig, unknown> = {
  kind: "merge",
  async execute(context) {
    const config = context.config;
    const branches = Array.from(
      { length: config.inputCount },
      (_, index) => context.inputs[`in${index}`] ?? [],
    );

    if (!config.waitForAll) {
      const emitted = context.state<boolean>(() => false);
      if (emitted.get()) return { outputs: {} };
      emitted.set(true);
      const first = branches.find((items) => items.length > 0) ?? [];
      return {
        items: first,
        diagnostics: { mode: "chooseBranch", taken: first.length },
      };
    }

    if (config.mode === "append")
      return {
        items: concatItems(...branches),
        diagnostics: { mode: "append" },
      };

    if (config.mode === "byPosition") {
      const length = Math.max(...branches.map((items) => items.length), 0);
      const merged: ScenarioItems = [];
      for (let index = 0; index < length; index++) {
        const json: Record<string, unknown> = {};
        const binary: Record<string, unknown> = {};
        for (const branch of branches) {
          const item = branch[index];
          if (!item) continue;
          if (
            item.json !== null &&
            typeof item.json === "object" &&
            !Array.isArray(item.json)
          )
            Object.assign(json, item.json);
          Object.assign(binary, item.binary ?? {});
        }
        merged.push({
          json,
          binary: Object.keys(binary).length ? (binary as never) : undefined,
          pairedItem: index,
        });
      }
      return {
        items: merged,
        diagnostics: { mode: "byPosition", produced: merged.length },
      };
    }

    const key = config.joinKey;
    const readKey = (item: ScenarioItem): string => {
      const source = item.json;
      if (source === null || typeof source !== "object") return "";
      return toText((source as Record<string, unknown>)[key]);
    };

    const [primary = [], ...rest] = branches;
    const indexes = rest.map((branch) => {
      const map = new Map<string, ScenarioItem[]>();
      for (const item of branch) {
        const value = readKey(item);
        map.set(value, [...(map.get(value) ?? []), item]);
      }
      return map;
    });

    const merged: ScenarioItems = [];
    const usedKeys = new Set<string>();
    primary.forEach((item, index) => {
      const value = readKey(item);
      usedKeys.add(value);
      const matches = indexes.map((map) => map.get(value) ?? []);
      const complete = matches.every((list) => list.length > 0);
      if (!complete && config.joinType === "inner") return;
      const json: Record<string, unknown> = {
        ...(item.json as Record<string, unknown>),
      };
      for (const list of matches)
        for (const match of list)
          if (match.json !== null && typeof match.json === "object")
            Object.assign(json, match.json);
      merged.push({
        json,
        binary: item.binary,
        pairedItem: item.pairedItem ?? index,
      });
    });

    if (config.joinType === "outer")
      for (const map of indexes)
        for (const [value, list] of map)
          if (!usedKeys.has(value)) merged.push(...list);

    return {
      items: merged,
      diagnostics: { mode: "byKey", produced: merged.length },
    };
  },
};

interface LoopConfig {
  batchSize: number;
  maxIterations: number;
  reset: boolean;
}

interface LoopState {
  queue: ScenarioItems;
  collected: ScenarioItems;
  iteration: number;
  started: boolean;
}

export const loopExecutor: NodeExecutor<LoopConfig, unknown> = {
  kind: "loop",
  async execute(context): Promise<NodeOutput> {
    const config = context.config;
    const cell = context.state<LoopState>(() => ({
      queue: [],
      collected: [],
      iteration: 0,
      started: false,
    }));
    const state = cell.get();

    if (!state.started || config.reset) {
      state.queue = [...context.items];
      state.collected = [];
      state.iteration = 0;
      state.started = true;
    } else {
      state.collected.push(...context.items);
    }

    if (state.queue.length === 0) {
      const done = state.collected;
      cell.set({ queue: [], collected: [], iteration: 0, started: false });
      return {
        outputs: { done },
        diagnostics: { iterations: state.iteration, collected: done.length },
      };
    }

    if (state.iteration >= config.maxIterations)
      throw new PermanentError(
        `Цикл «${context.node.name}» превысил лимит в ${config.maxIterations} итераций`,
        { context: { nodeId: context.node.id } },
      );

    const batch = state.queue.splice(0, Math.max(1, config.batchSize));
    state.iteration += 1;
    cell.set(state);
    return {
      outputs: { batch },
      diagnostics: {
        iteration: state.iteration,
        remaining: state.queue.length,
        batch: batch.length,
      },
    };
  },
};

interface LimitConfig {
  count: number;
  from: "first" | "last";
}

export const limitExecutor: NodeExecutor<LimitConfig, unknown> = {
  kind: "limit",
  async execute(context) {
    const { count, from } = context.config;
    const items =
      from === "last"
        ? context.items.slice(-count)
        : context.items.slice(0, count);
    return {
      items,
      diagnostics: {
        kept: items.length,
        dropped: context.items.length - items.length,
      },
    };
  },
};

export const noopExecutor: NodeExecutor<unknown, unknown> = {
  kind: "noop",
  async execute(context): Promise<NodeOutput> {
    return { outputs: { [MAIN_PORT]: context.items } };
  },
};

export const FLOW_EXECUTORS = [
  ifExecutor,
  filterExecutor,
  switchExecutor,
  mergeExecutor,
  loopExecutor,
  limitExecutor,
  noopExecutor,
] as Array<NodeExecutor<never, never>>;
