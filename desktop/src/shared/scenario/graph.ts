import { z } from "zod";

export const SCENARIO_GRAPH_VERSION = 2 as const;

export const scenarioDataKindSchema = z.enum(["main", "knowledge"]);
export type ScenarioDataKind = z.infer<typeof scenarioDataKindSchema>;

export const nodeErrorModeSchema = z.enum(["stop", "continue", "errorOutput"]);
export type NodeErrorMode = z.infer<typeof nodeErrorModeSchema>;

export const nodeRetryPolicySchema = z.object({
  maxTries: z.int().min(1).max(10).default(1),
  backoffMs: z.int().min(0).max(600_000).default(1_000),
  backoffFactor: z.number().min(1).max(10).default(2),
  maxBackoffMs: z.int().min(0).max(3_600_000).default(60_000),
});
export type NodeRetryPolicy = z.infer<typeof nodeRetryPolicySchema>;

export const nodeRuntimeSchema = z.object({
  retry: nodeRetryPolicySchema.optional(),
  onError: nodeErrorModeSchema.optional(),
  timeoutSeconds: z.int().min(1).max(86_400).optional(),
  itemMode: z.enum(["collection", "each"]).optional(),
  concurrency: z.int().min(1).max(32).optional(),
});
export type NodeRuntime = z.infer<typeof nodeRuntimeSchema>;

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const scenarioNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(2_000).default(""),
  x: z.number(),
  y: z.number(),
  config: z.record(z.string(), jsonValueSchema).default({}),
  runtime: nodeRuntimeSchema.default({}),
  disabled: z.boolean().default(false),
  notes: z.string().max(4_000).default(""),
  groupId: z.string().nullable().default(null),
});
export type ScenarioNode = z.infer<typeof scenarioNodeSchema>;

export const scenarioEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  sourcePort: z.string().min(1),
  target: z.string().min(1),
  targetPort: z.string().min(1),
});
export type ScenarioEdge = z.infer<typeof scenarioEdgeSchema>;

export const scenarioGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  collapsed: z.boolean().default(false),
  color: z.string().max(32).default(""),
});
export type ScenarioGroup = z.infer<typeof scenarioGroupSchema>;

export const scenarioVariableSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[A-Za-z_][A-Za-z0-9_]*$/,
      "Имя переменной: латиница, цифры и подчёркивание",
    ),
  value: jsonValueSchema,
  description: z.string().max(500).default(""),
});
export type ScenarioVariable = z.infer<typeof scenarioVariableSchema>;

export const scenarioGraphSchema = z.object({
  version: z.literal(SCENARIO_GRAPH_VERSION).default(SCENARIO_GRAPH_VERSION),
  nodes: z.array(scenarioNodeSchema).default([]),
  edges: z.array(scenarioEdgeSchema).default([]),
  groups: z.array(scenarioGroupSchema).default([]),
  variables: z.array(scenarioVariableSchema).default([]),
  maxNodeExecutions: z.int().min(1).max(100_000).default(1_000),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number() })
    .optional(),
});
export type ScenarioGraph = z.infer<typeof scenarioGraphSchema>;

export function emptyScenarioGraph(): ScenarioGraph {
  return scenarioGraphSchema.parse({ version: SCENARIO_GRAPH_VERSION });
}

export function isScenarioGraphV2(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === SCENARIO_GRAPH_VERSION
  );
}

export interface ScenarioValidationIssue {
  nodeId?: string;
  edgeId?: string;
  path?: string;
  severity: "error" | "warning";
  message: string;
}

export interface ScenarioValidationResult {
  valid: boolean;
  issues: ScenarioValidationIssue[];
}
