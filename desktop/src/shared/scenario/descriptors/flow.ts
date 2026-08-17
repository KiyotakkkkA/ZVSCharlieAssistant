import { z } from "zod";
import { exprNumber, exprText, exprValue } from "../config-fields";
import {
  errorOutput,
  mainInput,
  mainOutput,
  type PortSpec,
  type ScenarioNodeDescriptor,
} from "../node-descriptor";
import type { ScenarioValidationIssue } from "../graph";

export const comparisonOperatorSchema = z.enum([
  "equals",
  "notEquals",
  "contains",
  "notContains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
  "regex",
  "in",
]);
export type ComparisonOperator = z.infer<typeof comparisonOperatorSchema>;

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  equals: "равно",
  notEquals: "не равно",
  contains: "содержит",
  notContains: "не содержит",
  startsWith: "начинается с",
  endsWith: "заканчивается на",
  gt: "больше",
  gte: "больше или равно",
  lt: "меньше",
  lte: "меньше или равно",
  isEmpty: "пусто",
  isNotEmpty: "не пусто",
  isTrue: "истина",
  isFalse: "ложь",
  regex: "совпадает с шаблоном",
  in: "входит в список",
};

export const UNARY_OPERATORS = new Set<ComparisonOperator>([
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
]);

export const conditionSchema = z.object({
  left: exprValue(),
  operator: comparisonOperatorSchema.default("equals"),
  right: exprValue(),
  caseSensitive: z.boolean().default(false),
});
export type ConditionRule = z.infer<typeof conditionSchema>;

export const conditionGroupSchema = z.object({
  combinator: z.enum(["and", "or"]).default("and"),
  conditions: z.array(conditionSchema).default([]),
});
export type ConditionGroup = z.infer<typeof conditionGroupSchema>;

const ifConfigSchema = conditionGroupSchema;

export const ifDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof ifConfigSchema>
> = {
  kind: "if",
  label: "Условие",
  category: "flow",
  description: "Разделяет поток на две ветки по набору условий",
  documentation:
    "Каждый item проверяется независимо и уходит либо в выход «Да», либо в выход «Нет». " +
    "Ветка, в которую не попал ни один item, дальше не выполняется — узлы за ней пропускаются.",
  icon: "branch",
  accent: "#d97706",
  configSchema: ifConfigSchema,
  defaultConfig: () => ({
    combinator: "and",
    conditions: [
      { left: "", operator: "equals", right: "", caseSensitive: false },
    ],
  }),
  inputs: [mainInput()],
  outputs: [
    {
      id: "true",
      label: "Да",
      dataKind: "main",
      side: "right",
      multiple: true,
    },
    {
      id: "false",
      label: "Нет",
      dataKind: "main",
      side: "right",
      multiple: true,
    },
  ],
  itemMode: "collection",
  idempotent: true,
  validate: ({ node }) => {
    const issues: ScenarioValidationIssue[] = [];
    const conditions =
      (node.config as { conditions?: unknown[] }).conditions ?? [];
    if (conditions.length === 0)
      issues.push({
        nodeId: node.id,
        severity: "error",
        message: `У узла «${node.name}» не задано ни одного условия`,
      });
    return issues;
  },
};

const switchConfigSchema = z.object({
  mode: z.enum(["rules", "expression"]).default("rules"),
  rules: z
    .array(
      z.object({
        label: z.string().min(1).max(60).default("Ветка"),
        group: conditionGroupSchema.default({
          combinator: "and",
          conditions: [],
        }),
      }),
    )
    .default([]),
  expression: exprText(),
  allMatches: z.boolean().default(false),
  fallbackOutput: z.boolean().default(true),
});

export const switchDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof switchConfigSchema>
> = {
  kind: "switch",
  label: "Переключатель",
  category: "flow",
  description: "Разводит поток по нескольким веткам",
  documentation:
    "В режиме правил каждый выход соответствует своему набору условий. В режиме выражения " +
    "вычисленное значение сравнивается с меткой ветки. Выход «Иначе» получает всё, что не подошло.",
  icon: "switch",
  accent: "#d97706",
  configSchema: switchConfigSchema,
  defaultConfig: () => ({
    mode: "rules",
    rules: [{ label: "Ветка 1", group: { combinator: "and", conditions: [] } }],
    expression: "",
    allMatches: false,
    fallbackOutput: true,
  }),
  inputs: [mainInput()],
  outputs: (config) => {
    const rules = Array.isArray(config.rules)
      ? (config.rules as Array<{ label?: unknown }>)
      : [];
    const ports: PortSpec[] = rules.map((rule, index) => ({
      id: `out${index}`,
      label: String(rule?.label ?? `Ветка ${index + 1}`),
      dataKind: "main",
      side: "right",
      multiple: true,
    }));
    if (config.fallbackOutput !== false)
      ports.push({
        id: "fallback",
        label: "Иначе",
        dataKind: "main",
        side: "right",
        multiple: true,
      });
    return ports;
  },
  itemMode: "collection",
  idempotent: true,
  validate: ({ node }) => {
    const config = node.config as { rules?: Array<{ label?: string }> };
    const issues: ScenarioValidationIssue[] = [];
    if (!config.rules?.length)
      issues.push({
        nodeId: node.id,
        severity: "error",
        message: `У узла «${node.name}» нет ни одной ветки`,
      });
    const labels = new Set<string>();
    for (const rule of config.rules ?? []) {
      const label = String(rule?.label ?? "");
      if (labels.has(label))
        issues.push({
          nodeId: node.id,
          severity: "warning",
          message: `Ветка «${label}» встречается дважды — в режиме выражения это неоднозначно`,
        });
      labels.add(label);
    }
    return issues;
  },
};

export const filterDescriptor: ScenarioNodeDescriptor<ConditionGroup> = {
  kind: "filter",
  label: "Фильтр",
  category: "flow",
  description: "Пропускает дальше только подходящие items",
  icon: "filter",
  accent: "#d97706",
  configSchema: conditionGroupSchema,
  defaultConfig: () => ({ combinator: "and", conditions: [] }),
  inputs: [mainInput()],
  outputs: [mainOutput({ label: "Прошедшие" })],
  itemMode: "collection",
  idempotent: true,
};

const mergeConfigSchema = z.object({
  mode: z
    .enum(["append", "byKey", "byPosition", "chooseBranch"])
    .default("append"),
  inputCount: z.int().min(2).max(8).default(2),
  joinKey: exprText(),
  joinType: z.enum(["inner", "left", "outer"]).default("inner"),
  waitForAll: z.boolean().default(true),
});

export const mergeDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof mergeConfigSchema>
> = {
  kind: "merge",
  label: "Слияние",
  category: "flow",
  description: "Объединяет несколько веток в одну",
  documentation:
    "«Дописать» складывает items друг за другом. «По ключу» соединяет их как join по полю. " +
    "«По позиции» склеивает первый с первым, второй со вторым. " +
    "Если снять «ждать все входы», узел отдаст первую пришедшую ветку и не будет ждать остальные.",
  icon: "merge",
  accent: "#d97706",
  configSchema: mergeConfigSchema,
  defaultConfig: () => ({
    mode: "append",
    inputCount: 2,
    joinKey: "",
    joinType: "inner",
    waitForAll: true,
  }),
  inputs: (config) => {
    const count = Math.min(8, Math.max(2, Number(config.inputCount ?? 2)));
    const optional = config.waitForAll === false;
    return Array.from({ length: count }, (_, index) => ({
      id: `in${index}`,
      label: `Вход ${index + 1}`,
      dataKind: "main" as const,
      side: "left" as const,
      multiple: true,
      optional,
    }));
  },
  outputs: [mainOutput()],
  itemMode: "collection",
  idempotent: true,
  allowsLoopBack: true,
  validate: ({ node }) => {
    const config = node.config as { mode?: string; joinKey?: string };
    if (config.mode === "byKey" && !String(config.joinKey ?? "").trim())
      return [
        {
          nodeId: node.id,
          severity: "error",
          message: `Для слияния по ключу у узла «${node.name}» нужно указать поле`,
        },
      ];
    return [];
  },
};

const loopConfigSchema = z.object({
  batchSize: exprNumber({ min: 1, max: 10_000, fallback: 1 }),
  maxIterations: z.int().min(1).max(10_000).default(100),
  reset: z.boolean().default(false),
});

export const loopDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof loopConfigSchema>
> = {
  kind: "loop",
  label: "Цикл по батчам",
  category: "flow",
  description: "Отдаёт items порциями и повторяет ветку, пока они не кончатся",
  documentation:
    "Выход «Батч» отдаёт очередную порцию, конец ветки нужно вернуть обратно во вход узла — " +
    "это единственная разрешённая обратная связь в графе. Когда items кончатся, сработает выход «Готово» " +
    "со всеми накопленными результатами.",
  icon: "loop",
  accent: "#d97706",
  configSchema: loopConfigSchema,
  defaultConfig: () => ({ batchSize: 1, maxIterations: 100, reset: false }),
  inputs: [mainInput()],
  outputs: [
    {
      id: "batch",
      label: "Батч",
      dataKind: "main",
      side: "right",
      multiple: true,
    },
    {
      id: "done",
      label: "Готово",
      dataKind: "main",
      side: "bottom",
      multiple: true,
    },
  ],
  itemMode: "collection",
  allowsLoopBack: true,
  validate: ({ node, outgoing }) => {
    if (!outgoing.some((edge) => edge.sourcePort === "batch"))
      return [
        {
          nodeId: node.id,
          severity: "warning",
          message: `У цикла «${node.name}» не подключён выход «Батч» — тело цикла пусто`,
        },
      ];
    return [];
  },
};

const limitConfigSchema = z.object({
  count: exprNumber({ min: 1, max: 100_000, fallback: 10 }),
  from: z.enum(["first", "last"]).default("first"),
});

export const limitDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof limitConfigSchema>
> = {
  kind: "limit",
  label: "Ограничение",
  category: "flow",
  description: "Оставляет только первые или последние N items",
  icon: "limit",
  accent: "#d97706",
  configSchema: limitConfigSchema,
  defaultConfig: () => ({ count: 10, from: "first" }),
  inputs: [mainInput()],
  outputs: [mainOutput()],
  itemMode: "collection",
  idempotent: true,
};

const approvalConfigSchema = z.object({
  mode: z.enum(["confirm", "choice", "text"]).default("confirm"),
  header: exprText("Требуется решение"),
  prompt: exprText("Продолжить выполнение сценария?"),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        description: z.string().max(500).default(""),
      }),
    )
    .default([]),
  multiSelect: z.boolean().default(false),
  defaultAnswer: z.string().nullable().default(null),
  timeoutSeconds: z.int().min(10).max(604_800).nullable().default(null),
  channel: z.enum(["ui", "trigger", "telegram", "email"]).default("ui"),
  integrationProfileId: z.int().positive().nullable().default(null),
  recipient: z.string().max(320).default(""),
});

export const approvalDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof approvalConfigSchema>
> = {
  kind: "approval",
  label: "Вопрос человеку",
  category: "flow",
  description: "Приостанавливает сценарий до ответа пользователя",
  documentation:
    "Ран сохраняется на диск и снимается с исполнения, а не держит поток. " +
    "После ответа он продолжится с этого же узла — в том числе после перезапуска приложения.",
  icon: "question",
  accent: "#7c3aed",
  configSchema: approvalConfigSchema,
  defaultConfig: () => ({
    mode: "confirm",
    header: "Требуется решение",
    prompt: "Продолжить выполнение сценария?",
    options: [],
    multiSelect: false,
    defaultAnswer: null,
    timeoutSeconds: null,
    channel: "ui",
    integrationProfileId: null,
    recipient: "",
  }),
  inputs: [mainInput()],
  outputs: [
    {
      id: "main",
      label: "Ответ получен",
      dataKind: "main",
      side: "right",
      multiple: true,
    },
    {
      id: "rejected",
      label: "Отклонено",
      dataKind: "main",
      side: "bottom",
      multiple: true,
    },
  ],
  itemMode: "collection",
  defaults: { onError: "stop" },
  validate: ({ node }) => {
    const config = node.config as {
      mode?: string;
      options?: unknown[];
      channel?: string;
      recipient?: string;
      integrationProfileId?: number | null;
    };
    const issues: ScenarioValidationIssue[] = [];
    if (config.mode === "choice" && !(config.options?.length ?? 0))
      issues.push({
        nodeId: node.id,
        severity: "error",
        message: `Для режима «выбор» у узла «${node.name}» нужно задать варианты ответа`,
      });
    if (
      (config.channel === "telegram" || config.channel === "email") &&
      !config.integrationProfileId
    )
      issues.push({
        nodeId: node.id,
        severity: "error",
        message: `Для отправки вопроса во внешний канал у узла «${node.name}» нужно выбрать подключение`,
      });
    return issues;
  },
};

const subScenarioConfigSchema = z.object({
  scenarioId: z.string().default(""),
  mode: z.enum(["await", "fireAndForget"]).default("await"),
  input: z.enum(["items", "expression"]).default("items"),
  inputExpression: z.string().default(""),
});

export const subScenarioDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof subScenarioConfigSchema>
> = {
  kind: "subScenario",
  label: "Вложенный сценарий",
  category: "flow",
  description: "Вызывает другой сценарий как подпрограмму",
  documentation:
    "Позволяет переиспользовать общую логику и не раздувать один граф. " +
    "Вложенный сценарий исполняется на своей сохранённой ревизии.",
  icon: "subflow",
  accent: "#7c3aed",
  configSchema: subScenarioConfigSchema,
  defaultConfig: () => ({
    scenarioId: "",
    mode: "await",
    input: "items",
    inputExpression: "",
  }),
  inputs: [mainInput()],
  outputs: [mainOutput({ label: "Результат" }), errorOutput()],
  itemMode: "collection",
  defaults: { timeoutSeconds: 1_800 },
  validate: ({ node }) => {
    if (
      !String((node.config as { scenarioId?: string }).scenarioId ?? "").trim()
    )
      return [
        {
          nodeId: node.id,
          severity: "error",
          message: `У узла «${node.name}» не выбран вложенный сценарий`,
        },
      ];
    return [];
  },
};

export const FLOW_DESCRIPTORS = [
  ifDescriptor,
  switchDescriptor,
  filterDescriptor,
  mergeDescriptor,
  loopDescriptor,
  limitDescriptor,
  approvalDescriptor,
  subScenarioDescriptor,
] as unknown as Array<ScenarioNodeDescriptor<never>>;
