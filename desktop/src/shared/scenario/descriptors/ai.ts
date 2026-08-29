import { z } from "zod";
import { entityIdSchema } from "../../dto/ipc-dto";
import { exprText } from "../config-fields";
import {
  errorOutput,
  filesInput,
  filesOutput,
  knowledgeInput,
  mainInput,
  mainOutput,
  type ScenarioNodeDescriptor,
} from "../node-descriptor";

const agentConfigSchema = z.object({
  agentId: entityIdSchema,
  scenarioInstructions: exprText(),
  input: z.enum(["items", "expression"]).default("items"),
  inputExpression: exprText(),
  outputMode: z.enum(["text", "json"]).default("text"),
  jsonSchema: z.string().default(""),
  modelId: entityIdSchema.nullable().default(null),
  maxToolCalls: z.int().min(1).max(100).nullable().default(null),
  temperature: z.number().min(0).max(2).nullable().default(null),
  targetField: z.string().default("text"),
});

export const agentDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof agentConfigSchema>
> = {
  kind: "agent",
  label: "Агент",
  category: "ai",
  description: "Выполняет задачу с помощью модели и инструментов",
  icon: "agent",
  accent: "#059669",
  configSchema: agentConfigSchema,
  defaultConfig: () => ({
    agentId: "",
    scenarioInstructions: "",
    input: "items",
    inputExpression: "",
    outputMode: "text",
    jsonSchema: "",
    modelId: null,
    maxToolCalls: null,
    temperature: null,
    targetField: "text",
  }),
  inputs: [mainInput(), knowledgeInput(), filesInput()],
  outputs: [mainOutput({ label: "Результат" }), filesOutput(), errorOutput()],
  itemMode: "collection",
  defaults: {
    retry: {
      maxTries: 2,
      backoffMs: 2_000,
      backoffFactor: 2,
      maxBackoffMs: 30_000,
    },
    timeoutSeconds: 300,
  },
  validate: ({ node }) => {
    const config = node.config as {
      agentId?: string;
      outputMode?: string;
      jsonSchema?: string;
    };
    const issues = [];
    if (!String(config.agentId ?? "").trim())
      issues.push({
        nodeId: node.id,
        severity: "error" as const,
        message: `Для узла «${node.name}» не выбран агент`,
      });
    if (
      config.outputMode === "json" &&
      String(config.jsonSchema ?? "").trim()
    ) {
      try {
        JSON.parse(String(config.jsonSchema));
      } catch {
        issues.push({
          nodeId: node.id,
          path: "jsonSchema",
          severity: "error" as const,
          message: `Схема ответа узла «${node.name}» не является корректным JSON`,
        });
      }
    }
    return issues;
  },
};

const orchestratorConfigSchema = z.object({
  modelId: entityIdSchema.nullable().default(null),
  mode: z.enum(["graph", "llm"]).default("llm"),
  objective: exprText(),
  synthesize: z.boolean().default(true),
  synthesisInstructions: z.string().max(4_000).default(""),
  strictPlan: z.boolean().default(true),
  maxOutputTokens: z.int().min(256).max(32_000).default(2_400),
});

export const orchestratorDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof orchestratorConfigSchema>
> = {
  kind: "orchestrator",
  label: "Оркестратор",
  category: "ai",
  description: "Распределяет задачу между подключёнными агентами",
  documentation:
    "Получает общую задачу и раздаёт её подключённым агентам. Можно раздавать по схеме — тогда каждый агент получит своё задание по порядку, — либо доверить распределение модели: она сама решит, кому что поручить. Если модель предложит непонятный план, узел остановится с ошибкой, а не отдаст всем одно и то же задание.",
  icon: "orchestrator",
  accent: "#059669",
  configSchema: orchestratorConfigSchema,
  defaultConfig: () => ({
    modelId: null,
    mode: "llm",
    objective: "",
    synthesize: true,
    synthesisInstructions: "",
    strictPlan: true,
    maxOutputTokens: 2_400,
  }),
  inputs: [mainInput()],
  outputs: [
    {
      id: "workers",
      label: "Исполнители",
      dataKind: "main",
      side: "bottom",
      multiple: true,
    },
    mainOutput({ label: "Результат" }),
    errorOutput(),
  ],
  itemMode: "collection",
  defaults: { timeoutSeconds: 600 },
  validate: ({ node, outgoing }) => {
    if (!outgoing.some((edge) => edge.sourcePort === "workers"))
      return [
        {
          nodeId: node.id,
          severity: "error",
          message: `К оркестратору «${node.name}» не подключён ни один исполнитель`,
        },
      ];
    return [];
  },
};

const classifyConfigSchema = z.object({
  modelId: entityIdSchema.nullable().default(null),
  input: exprText(),
  categories: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        description: z.string().max(500).default(""),
      }),
    )
    .default([]),
  allowMultiple: z.boolean().default(false),
  fallbackOutput: z.boolean().default(true),
});

export const classifyDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof classifyConfigSchema>
> = {
  kind: "classify",
  label: "Классификатор",
  category: "ai",
  description: "Раскладывает записи по веткам с помощью модели",
  documentation:
    "Раскладывает входящее по категориям, которые вы опишете своими словами. В отличие от «Переключателя», который сравнивает поля буквально, здесь решение принимает модель — по смыслу написанного.",
  icon: "classify",
  accent: "#059669",
  configSchema: classifyConfigSchema,
  defaultConfig: () => ({
    modelId: null,
    input: "{{ $json.text }}",
    categories: [{ label: "Категория 1", description: "" }],
    allowMultiple: false,
    fallbackOutput: true,
  }),
  inputs: [mainInput()],
  outputs: (config) => {
    const categories = Array.isArray(config.categories)
      ? (config.categories as Array<{ label?: unknown }>)
      : [];
    const ports = categories.map((category, index) => ({
      id: `out${index}`,
      label: String(category?.label ?? `Категория ${index + 1}`),
      dataKind: "main" as const,
      side: "right" as const,
      multiple: true,
    }));
    if (config.fallbackOutput !== false)
      ports.push({
        id: "fallback",
        label: "Иначе",
        dataKind: "main" as const,
        side: "right" as const,
        multiple: true,
      });
    return ports;
  },
  itemMode: "each",
  defaults: { retry: { maxTries: 2 }, timeoutSeconds: 120, concurrency: 3 },
  validate: ({ node }) => {
    const categories =
      (node.config as { categories?: unknown[] }).categories ?? [];
    if (categories.length === 0)
      return [
        {
          nodeId: node.id,
          severity: "error",
          message: `У узла «${node.name}» нет ни одной категории`,
        },
      ];
    return [];
  },
};

export const AI_DESCRIPTORS = [
  agentDescriptor,
  orchestratorDescriptor,
  classifyDescriptor,
] as unknown as Array<ScenarioNodeDescriptor<never>>;
