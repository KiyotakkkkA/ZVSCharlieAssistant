import { z } from "zod";
import {
  exprNumber,
  exprStringList,
  exprText,
  exprValue,
} from "../config-fields";
import {
  errorOutput,
  knowledgeOutput,
  mainInput,
  mainOutput,
  type ScenarioNodeDescriptor,
} from "../node-descriptor";

const setConfigSchema = z.object({
  keepOnlySet: z.boolean().default(false),
  fields: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        value: exprValue(),
        type: z
          .enum(["auto", "string", "number", "boolean", "json"])
          .default("auto"),
      }),
    )
    .default([]),
  remove: z.array(z.string()).default([]),
});

export const setDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof setConfigSchema>
> = {
  kind: "set",
  label: "Поля",
  category: "data",
  description: "Задаёт, переименовывает и удаляет поля items",
  documentation:
    "Основной способ переложить данные между узлами без обращения к модели. " +
    "Значение поля — выражение: `{{ $json.user.email }}`, `Re: {{ $trigger.entity.subject }}`.",
  icon: "fields",
  accent: "#0891b2",
  configSchema: setConfigSchema,
  defaultConfig: () => ({
    keepOnlySet: false,
    fields: [{ name: "", value: "", type: "auto" }],
    remove: [],
  }),
  inputs: [mainInput()],
  outputs: [mainOutput()],
  itemMode: "each",
  idempotent: true,
};

const aggregateConfigSchema = z.object({
  mode: z.enum(["allItems", "concatenate", "summary"]).default("allItems"),
  targetField: z.string().default("data"),
  sourceField: exprText(),
  separator: exprText("\n\n"),
  aggregations: z
    .array(
      z.object({
        field: z.string().min(1),
        operation: z.enum([
          "count",
          "sum",
          "avg",
          "min",
          "max",
          "unique",
          "first",
          "last",
        ]),
        as: z.string().default(""),
      }),
    )
    .default([]),
  groupBy: z.string().default(""),
});

export const aggregateDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof aggregateConfigSchema>
> = {
  kind: "aggregate",
  label: "Свёртка",
  category: "data",
  description: "Собирает коллекцию items в один",
  icon: "aggregate",
  accent: "#0891b2",
  configSchema: aggregateConfigSchema,
  defaultConfig: () => ({
    mode: "allItems",
    targetField: "data",
    sourceField: "",
    separator: "\n\n",
    aggregations: [],
    groupBy: "",
  }),
  inputs: [mainInput()],
  outputs: [mainOutput()],
  itemMode: "collection",
  idempotent: true,
};

const splitOutConfigSchema = z.object({
  field: exprText(),
  keepParentFields: z.boolean().default(false),
  targetField: z.string().default("value"),
});

export const splitOutDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof splitOutConfigSchema>
> = {
  kind: "splitOut",
  label: "Развернуть список",
  category: "data",
  description: "Превращает массив внутри поля в отдельные items",
  documentation:
    "Обратная операция к свёртке. Если модель вернула список из десяти задач, " +
    "этот узел сделает из них десять items, и следующий узел обработает каждую отдельно.",
  icon: "split",
  accent: "#0891b2",
  configSchema: splitOutConfigSchema,
  defaultConfig: () => ({
    field: "",
    keepParentFields: false,
    targetField: "value",
  }),
  inputs: [mainInput()],
  outputs: [mainOutput()],
  itemMode: "collection",
  idempotent: true,
  validate: ({ node }) => {
    if (!String((node.config as { field?: string }).field ?? "").trim())
      return [
        {
          nodeId: node.id,
          severity: "error",
          message: `У узла «${node.name}» не указано поле со списком`,
        },
      ];
    return [];
  },
};

const sortConfigSchema = z.object({
  rules: z
    .array(
      z.object({
        field: z.string().min(1),
        direction: z.enum(["asc", "desc"]).default("asc"),
      }),
    )
    .default([]),
});

export const sortDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof sortConfigSchema>
> = {
  kind: "sort",
  label: "Сортировка",
  category: "data",
  description: "Упорядочивает items по одному или нескольким полям",
  icon: "sort",
  accent: "#0891b2",
  configSchema: sortConfigSchema,
  defaultConfig: () => ({ rules: [{ field: "", direction: "asc" }] }),
  inputs: [mainInput()],
  outputs: [mainOutput()],
  itemMode: "collection",
  idempotent: true,
};

const dedupeConfigSchema = z.object({
  mode: z.enum(["allFields", "selectedFields"]).default("allFields"),
  fields: z.array(z.string()).default([]),
});

export const deduplicateDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof dedupeConfigSchema>
> = {
  kind: "deduplicate",
  label: "Без дубликатов",
  category: "data",
  description: "Убирает повторяющиеся items",
  icon: "dedupe",
  accent: "#0891b2",
  configSchema: dedupeConfigSchema,
  defaultConfig: () => ({ mode: "allFields", fields: [] }),
  inputs: [mainInput()],
  outputs: [mainOutput()],
  itemMode: "collection",
  idempotent: true,
};

const httpConfigSchema = z.object({
  method: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
    .default("GET"),
  url: exprText(),
  headers: z
    .array(z.object({ key: z.string(), value: exprText() }))
    .default([]),
  query: z.array(z.object({ key: z.string(), value: exprText() })).default([]),
  bodyMode: z.enum(["none", "json", "text", "form"]).default("none"),
  body: exprValue(),
  authSecretId: z.int().positive().nullable().default(null),
  authScheme: z.enum(["bearer", "basic", "raw", "header"]).default("bearer"),
  authHeaderName: z.string().default("Authorization"),
  timeoutSeconds: exprNumber({ min: 1, max: 600, fallback: 60 }),
  parseJson: z.boolean().default(true),
  failOnErrorStatus: z.boolean().default(true),
  maxResponseMb: z.int().min(1).max(256).default(16),
  followRedirects: z.boolean().default(true),
});

export const httpDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof httpConfigSchema>
> = {
  kind: "http",
  label: "HTTP-запрос",
  category: "io",
  description: "Обращается к внешнему API",
  documentation:
    "URL, заголовки и тело поддерживают выражения. Токен берётся из хранилища секретов " +
    "и не попадает ни в граф, ни в логи.",
  icon: "http",
  accent: "#2563eb",
  configSchema: httpConfigSchema,
  defaultConfig: () => ({
    method: "GET",
    url: "",
    headers: [],
    query: [],
    bodyMode: "none",
    body: "",
    authSecretId: null,
    authScheme: "bearer",
    authHeaderName: "Authorization",
    timeoutSeconds: 60,
    parseJson: true,
    failOnErrorStatus: true,
    maxResponseMb: 16,
    followRedirects: true,
  }),
  inputs: [mainInput()],
  outputs: [mainOutput({ label: "Ответ" }), errorOutput()],
  itemMode: "each",
  defaults: {
    retry: {
      maxTries: 3,
      backoffMs: 1_000,
      backoffFactor: 2,
      maxBackoffMs: 30_000,
    },
    timeoutSeconds: 120,
    concurrency: 4,
  },
  validate: ({ node }) => {
    const config = node.config as { url?: string };
    if (!String(config.url ?? "").trim())
      return [
        {
          nodeId: node.id,
          severity: "error",
          message: `У узла «${node.name}» не задан URL`,
        },
      ];
    return [];
  },
};

const downloadFilesConfigSchema = z.object({
  source: z.enum(["binary", "urls"]).default("binary"),
  urls: exprStringList(),
  maxFileSizeMb: exprNumber({ min: 1, max: 1_024, fallback: 50 }),
  maxFiles: exprNumber({ min: 1, max: 200, fallback: 20 }),
  cleanupOnFinish: z.boolean().default(true),
});

export const downloadFilesDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof downloadFilesConfigSchema>
> = {
  kind: "downloadFiles",
  label: "Скачать файлы",
  category: "io",
  description: "Сохраняет вложения на диск и подставляет ссылки в items",
  icon: "download",
  accent: "#2563eb",
  configSchema: downloadFilesConfigSchema,
  defaultConfig: () => ({
    source: "binary",
    urls: "",
    maxFileSizeMb: 50,
    maxFiles: 20,
    cleanupOnFinish: true,
  }),
  inputs: [mainInput()],
  outputs: [mainOutput({ label: "Файлы" }), errorOutput()],
  itemMode: "collection",
  defaults: {
    retry: {
      maxTries: 3,
      backoffMs: 2_000,
      backoffFactor: 2,
      maxBackoffMs: 30_000,
    },
    onError: "continue",
    timeoutSeconds: 900,
  },
};

const readFilesConfigSchema = z.object({
  maxCharactersPerFile: z.int().min(1_000).max(2_000_000).default(100_000),
  output: z.enum(["inline", "reference"]).default("inline"),
  targetField: z.string().default("text"),
  itemPerFile: z.boolean().default(true),
});

export const readFilesDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof readFilesConfigSchema>
> = {
  kind: "readFiles",
  label: "Прочитать файлы",
  category: "io",
  description: "Извлекает текст из вложений",
  documentation:
    "Поддерживаются pdf, docx, txt и другие текстовые форматы. " +
    "Крупный текст автоматически выносится из базы в файл выгрузки — в истории останется ссылка.",
  icon: "read",
  accent: "#2563eb",
  configSchema: readFilesConfigSchema,
  defaultConfig: () => ({
    maxCharactersPerFile: 100_000,
    output: "inline",
    targetField: "text",
    itemPerFile: true,
  }),
  inputs: [mainInput()],
  outputs: [mainOutput({ label: "Текст" }), errorOutput()],
  itemMode: "collection",
  defaults: { onError: "continue", timeoutSeconds: 600 },
  validate: ({ node, graph }) => {
    const feedsFromTrigger = walkUpstream(graph, node.id);
    if (feedsFromTrigger.trigger && !feedsFromTrigger.download)
      return [
        {
          nodeId: node.id,
          severity: "warning",
          message: `Перед узлом «${node.name}» нет узла «Скачать файлы» — вложения из триггера не будут прочитаны`,
        },
      ];
    return [];
  },
};

function walkUpstream(
  graph: {
    nodes: Array<{ id: string; kind: string }>;
    edges: Array<{ source: string; target: string }>;
  },
  nodeId: string,
): { trigger: boolean; download: boolean } {
  const kindById = new Map(graph.nodes.map((node) => [node.id, node.kind]));
  const seen = new Set<string>([nodeId]);
  const queue = [nodeId];
  let trigger = false;
  let download = false;

  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.target !== current || seen.has(edge.source)) continue;
      seen.add(edge.source);
      queue.push(edge.source);
      const kind = kindById.get(edge.source) ?? "";
      if (kind.startsWith("trigger.")) trigger = true;
      if (kind === "downloadFiles") download = true;
    }
  }

  return { trigger, download };
}

const knowledgeStoreConfigSchema = z.object({
  vectorStoreId: z.int().positive(),
  limit: z.int().min(1).max(100).default(8),
  minScore: z.number().min(0).max(1).default(0),
});

export const knowledgeStoreDescriptor: ScenarioNodeDescriptor<
  z.infer<typeof knowledgeStoreConfigSchema>
> = {
  kind: "knowledgeStore",
  label: "База знаний",
  category: "ai",
  description: "Подключает векторное хранилище к агенту",
  documentation:
    "Соединяется с входом «База знаний» агента. Найденные фрагменты попадают в контекст " +
    "как недоверенные данные: агенту прямо запрещено выполнять инструкции из документов.",
  icon: "knowledge",
  accent: "#059669",
  configSchema: knowledgeStoreConfigSchema,
  defaultConfig: () => ({ vectorStoreId: 0, limit: 8, minScore: 0 }),
  inputs: [],
  outputs: [knowledgeOutput()],
  itemMode: "collection",
  idempotent: true,
  isTrigger: true,
  validate: ({ node, outgoing }) => {
    const config = node.config as { vectorStoreId?: number };
    const issues = [];
    if (!config.vectorStoreId || config.vectorStoreId < 1)
      issues.push({
        nodeId: node.id,
        severity: "error" as const,
        message: `Для узла «${node.name}» не выбрано хранилище`,
      });
    if (outgoing.length === 0)
      issues.push({
        nodeId: node.id,
        severity: "warning" as const,
        message: `База знаний «${node.name}» ни к чему не подключена`,
      });
    return issues;
  },
};

export const DATA_DESCRIPTORS = [
  setDescriptor,
  aggregateDescriptor,
  splitOutDescriptor,
  sortDescriptor,
  deduplicateDescriptor,
  httpDescriptor,
  downloadFilesDescriptor,
  readFilesDescriptor,
  knowledgeStoreDescriptor,
] as unknown as Array<ScenarioNodeDescriptor<never>>;
