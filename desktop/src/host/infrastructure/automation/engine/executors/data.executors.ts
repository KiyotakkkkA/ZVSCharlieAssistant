import {
  getPath,
  resolveDeep,
  toNumber,
  toText,
} from "../../../../../shared/expressions";
import { PermanentError } from "../../../../../shared/scenario/errors";
import {
  isRecord,
  type ScenarioItem,
  type ScenarioItems,
} from "../../../../../shared/scenario/items";
import type { NodeExecutor } from "../../../../../shared/scenario/node-descriptor";

interface SetConfig {
  keepOnlySet: boolean;
  fields: Array<{
    name: string;
    value: unknown;
    type: "auto" | "string" | "number" | "boolean" | "json";
  }>;
  remove: string[];
}

function coerce(
  value: unknown,
  type: SetConfig["fields"][number]["type"],
): unknown {
  switch (type) {
    case "string":
      return toText(value);
    case "number": {
      const parsed = toNumber(value);
      if (Number.isNaN(parsed))
        throw new PermanentError(
          `Значение «${toText(value)}» не является числом`,
        );
      return parsed;
    }
    case "boolean":
      return (
        value === true || value === 1 || toText(value).toLowerCase() === "true"
      );
    case "json":
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value) as unknown;
      } catch {
        throw new PermanentError(
          `Значение не является корректным JSON: ${value.slice(0, 80)}`,
        );
      }
    default:
      return value;
  }
}

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) return;
  let current = target;
  for (let index = 0; index < segments.length - 1; index++) {
    const segment = segments[index]!;
    if (
      segment === "__proto__" ||
      segment === "constructor" ||
      segment === "prototype"
    )
      return;
    const next = current[segment];
    if (!isRecord(next)) current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  }
  const last = segments[segments.length - 1]!;
  if (last === "__proto__" || last === "constructor" || last === "prototype")
    return;
  current[last] = value;
}

function deletePath(target: Record<string, unknown>, path: string): void {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = target;
  for (let index = 0; index < segments.length - 1; index++) {
    if (!isRecord(current)) return;
    current = current[segments[index]!];
  }
  if (isRecord(current)) delete current[segments[segments.length - 1]!];
}

export const setExecutor: NodeExecutor<SetConfig, unknown> = {
  kind: "set",
  async execute(context) {
    const config = context.config;
    const source = context.items[0];
    const base: Record<string, unknown> = config.keepOnlySet
      ? {}
      : isRecord(source?.json)
        ? { ...source.json }
        : source?.json === undefined
          ? {}
          : { value: source.json };

    for (const field of config.fields) {
      if (!field.name?.trim()) continue;
      setPath(base, field.name.trim(), coerce(field.value, field.type));
    }
    for (const path of config.remove)
      if (path.trim()) deletePath(base, path.trim());

    return {
      items: [
        { json: base, binary: source?.binary, pairedItem: source?.pairedItem },
      ],
    };
  },
};

interface AggregateConfig {
  mode: "allItems" | "concatenate" | "summary";
  targetField: string;
  sourceField: string;
  separator: string;
  aggregations: Array<{ field: string; operation: string; as: string }>;
  groupBy: string;
}

function aggregateValues(values: unknown[], operation: string): unknown {
  switch (operation) {
    case "count":
      return values.length;
    case "sum":
      return values.reduce(
        (total: number, value) => total + (toNumber(value) || 0),
        0,
      );
    case "avg":
      return values.length
        ? values.reduce(
            (total: number, value) => total + (toNumber(value) || 0),
            0,
          ) / values.length
        : 0;
    case "min":
      return values.length
        ? Math.min(
            ...values
              .map((value) => toNumber(value))
              .filter((value) => !Number.isNaN(value)),
          )
        : null;
    case "max":
      return values.length
        ? Math.max(
            ...values
              .map((value) => toNumber(value))
              .filter((value) => !Number.isNaN(value)),
          )
        : null;
    case "unique":
      return [...new Set(values.map((value) => toText(value)))];
    case "first":
      return values[0] ?? null;
    case "last":
      return values.at(-1) ?? null;
    default:
      return null;
  }
}

export const aggregateExecutor: NodeExecutor<AggregateConfig, unknown> = {
  kind: "aggregate",
  async execute(context) {
    const config = context.config;
    const items = context.items;

    if (config.mode === "concatenate") {
      const text = items
        .map((item) =>
          config.sourceField
            ? toText(getPath(item.json, config.sourceField))
            : toText(item.json),
        )
        .filter((entry) => entry !== "")
        .join(config.separator);
      return {
        items: [
          {
            json: { [config.targetField || "text"]: text, count: items.length },
          },
        ],
      };
    }

    if (config.mode === "allItems") {
      const binary: Record<string, unknown> = {};
      for (const item of items) Object.assign(binary, item.binary ?? {});
      return {
        items: [
          {
            json: {
              [config.targetField || "data"]: items.map((item) => item.json),
              count: items.length,
            },
            binary: Object.keys(binary).length ? (binary as never) : undefined,
          },
        ],
      };
    }

    const buildSummary = (rows: ScenarioItems): Record<string, unknown> => {
      const summary: Record<string, unknown> = { count: rows.length };
      for (const aggregation of config.aggregations) {
        const values = rows.map((item) =>
          getPath(item.json, aggregation.field),
        );
        summary[
          aggregation.as?.trim() ||
            `${aggregation.operation}_${aggregation.field}`
        ] = aggregateValues(values, aggregation.operation);
      }
      return summary;
    };

    if (!config.groupBy.trim())
      return { items: [{ json: buildSummary(items) }] };

    const groups = new Map<string, ScenarioItems>();
    for (const item of items) {
      const key = toText(getPath(item.json, config.groupBy));
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return {
      items: [...groups.entries()].map(([key, rows], index) => ({
        json: { [config.groupBy]: key, ...buildSummary(rows) },
        pairedItem: index,
      })),
    };
  },
};

interface SplitOutConfig {
  field: string;
  keepParentFields: boolean;
  targetField: string;
}

export const splitOutExecutor: NodeExecutor<SplitOutConfig, unknown> = {
  kind: "splitOut",
  async execute(context) {
    const config = context.config;
    const result: ScenarioItems = [];

    context.items.forEach((item, parentIndex) => {
      const raw = getPath(item.json, config.field);
      const list = Array.isArray(raw)
        ? raw
        : raw === undefined || raw === null
          ? []
          : [raw];
      const parent = isRecord(item.json) ? item.json : {};
      for (const entry of list) {
        const json = isRecord(entry)
          ? config.keepParentFields
            ? { ...parent, ...entry }
            : entry
          : config.keepParentFields
            ? { ...parent, [config.targetField || "value"]: entry }
            : { [config.targetField || "value"]: entry };
        result.push({ json, binary: item.binary, pairedItem: parentIndex });
      }
    });

    return { items: result, diagnostics: { produced: result.length } };
  },
};

interface SortConfig {
  rules: Array<{ field: string; direction: "asc" | "desc" }>;
}

export const sortExecutor: NodeExecutor<SortConfig, unknown> = {
  kind: "sort",
  async execute(context) {
    const rules = context.config.rules.filter((rule) => rule.field.trim());
    if (rules.length === 0) return { items: context.items };

    const compare = (left: ScenarioItem, right: ScenarioItem): number => {
      for (const rule of rules) {
        const leftValue = getPath(left.json, rule.field);
        const rightValue = getPath(right.json, rule.field);
        const leftNumber = toNumber(leftValue);
        const rightNumber = toNumber(rightValue);
        let result: number;
        if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber))
          result = leftNumber - rightNumber;
        else {
          const leftText = toText(leftValue);
          const rightText = toText(rightValue);
          result = leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
        }
        if (result !== 0) return rule.direction === "desc" ? -result : result;
      }
      return 0;
    };

    return { items: [...context.items].sort(compare) };
  },
};

interface DedupeConfig {
  mode: "allFields" | "selectedFields";
  fields: string[];
}

export const deduplicateExecutor: NodeExecutor<DedupeConfig, unknown> = {
  kind: "deduplicate",
  async execute(context) {
    const config = context.config;
    const seen = new Set<string>();
    const result: ScenarioItems = [];

    for (const item of context.items) {
      const signature =
        config.mode === "selectedFields" && config.fields.length
          ? JSON.stringify(
              config.fields.map((field) => getPath(item.json, field)),
            )
          : JSON.stringify(item.json ?? null);
      if (seen.has(signature)) continue;
      seen.add(signature);
      result.push(item);
    }

    return {
      items: result,
      diagnostics: { removed: context.items.length - result.length },
    };
  },
};

function passthroughTrigger(kind: string): NodeExecutor<unknown, unknown> {
  return {
    kind,
    async execute(context) {
      const defaults = (
        context.config as {
          inputFields?: Array<{ name: string; defaultValue?: string }>;
        }
      )?.inputFields;
      if (kind === "trigger.manual" && defaults?.length) {
        const first = context.items[0];
        const json = isRecord(first?.json) ? { ...first.json } : {};
        for (const field of defaults)
          if (
            json[field.name] === undefined &&
            field.defaultValue !== undefined &&
            field.defaultValue !== ""
          )
            json[field.name] = resolveDeep(field.defaultValue, {
              scope: context.scope(),
              onError: "empty",
            });
        return { items: [{ json, binary: first?.binary }] };
      }
      return { items: context.items };
    },
  };
}

export const DATA_EXECUTORS = [
  setExecutor,
  aggregateExecutor,
  splitOutExecutor,
  sortExecutor,
  deduplicateExecutor,
  passthroughTrigger("trigger.manual"),
  passthroughTrigger("trigger.interval"),
  passthroughTrigger("trigger.telegram"),
  passthroughTrigger("trigger.email"),
] as Array<NodeExecutor<never, never>>;
